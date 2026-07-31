// Two-way sync between the local IndexedDB library and Firestore:
// `push*`/`*Remote` send local changes up; `pullLibrarySnapshot` brings down
// whatever this device doesn't have yet or is behind on (per-item
// last-write-wins via `updatedAt`), called right after sign-in alongside the
// push. See PROJECT_DOCUMENTATION.md § Faz F for the full design and its
// Deletions are represented by account-scoped tombstones. A tombstone is
// written before stale remote data is pruned, remains locally durable across
// offline/restart, and wins over an older book/highlight/bookmark write.
//
// Book files themselves are never part of this — only metadata lives in
// Firestore. The actual EPUB/PDF blob is fetched from Google Drive lazily,
// the first time a pulled book is opened (see
// components/reader/useReaderBootstrap.ts).
//
// Schema: users/{uid}/books/{bookId} (book metadata + its progress merged
// in), users/{uid}/books/{bookId}/highlights/{id}, .../bookmarks/{id}, and
// users/{uid}/settings/reader.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Firestore,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import {
  getAllBooks,
  getAllMetadataForBackup,
  getBook,
  getBookFile,
  getBookmark,
  getBookmarks,
  getHighlight,
  getHighlights,
  getProgress,
  getSyncTombstones,
  getSyncOutboxOperations,
  completeSyncOutboxOperation,
  failSyncOutboxOperation,
  deleteBookLocal,
  deleteBookmarkLocal,
  deleteHighlightLocal,
  upsertBookMetadata,
  upsertBookmarkLocal,
  upsertHighlightLocal,
  upsertProgressLocal,
  upsertSyncOutboxOperation,
  upsertSyncTombstone,
} from "./storage";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DriveSyncError, deleteBookFileFromDrive, uploadBookFileToDrive } from "./drive-sync";
import { translate } from "./i18n/useTranslation";
import { toast } from "@/store/useToastStore";
import { useSyncStatusStore } from "@/store/useSyncStatusStore";
import type {
  Book,
  BookFormat,
  Bookmark,
  Highlight,
  ReaderSettings,
  ReadingProgress,
  SyncOutboxOperation,
  SyncTombstone,
} from "./types";
import { runTrackedSync } from "./sync-lifecycle";
import {
  createSyncTombstone,
  newestTombstones,
  syncTombstoneId,
  tombstoneCovers,
} from "./sync-tombstones";
import {
  classifySyncError,
  createSyncOutboxOperation,
  syncRetryDelayMs,
} from "./sync-outbox";

const MAX_BATCH_OPS = 450; // Firestore's actual limit is 500 — leave headroom.
const outboxDrains = new Map<string, Promise<void>>();
const outboxRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function currentUser() {
  const { useAuthStore } = await import("@/store/useAuthStore");
  return useAuthStore.getState().user;
}

async function currentUid(): Promise<string | null> {
  return (await currentUser())?.uid ?? null;
}

function hasGoogleProvider(
  user: Awaited<ReturnType<typeof currentUser>>
): boolean {
  return Boolean(
    user &&
      (user.providerId === "google.com" ||
        user.providerData.some(
          (provider) => provider.providerId === "google.com"
        ))
  );
}

function bookDoc(uid: string, bookId: string, db: NonNullable<ReturnType<typeof getFirebaseDb>>) {
  return doc(db, "users", uid, "books", bookId);
}

function tombstoneDoc(
  uid: string,
  tombstoneId: string,
  db: NonNullable<ReturnType<typeof getFirebaseDb>>
) {
  return doc(db, "users", uid, "tombstones", tombstoneId);
}

function remoteTombstoneData(tombstone: SyncTombstone): Record<string, unknown> {
  return {
    entity: tombstone.entity,
    bookId: tombstone.bookId,
    itemId: tombstone.itemId ?? null,
    driveFileId: tombstone.driveFileId ?? null,
    deletedAt: tombstone.deletedAt,
    serverDeletedAt: serverTimestamp(),
  };
}

function timestampMillis(value: unknown): number | null {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return null;
}

async function deleteRemoteRefs(
  db: NonNullable<ReturnType<typeof getFirebaseDb>>,
  refs: ReturnType<typeof doc>[]
): Promise<void> {
  for (let offset = 0; offset < refs.length; offset += MAX_BATCH_OPS) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(offset, offset + MAX_BATCH_OPS)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function pruneRemoteTombstone(
  uid: string,
  tombstone: SyncTombstone,
  db: NonNullable<ReturnType<typeof getFirebaseDb>>
): Promise<void> {
  if (tombstone.entity === "book") {
    const ref = bookDoc(uid, tombstone.bookId, db);
    const snapshot = await getDoc(ref);
    const data = snapshot.data();
    const remoteUpdatedAt =
      typeof data?.updatedAt === "number" ? data.updatedAt : 0;
    if (snapshot.exists() && remoteUpdatedAt > tombstone.deletedAt) return;

    const driveFileId =
      tombstone.driveFileId ??
      (data?.driveFileId as string | undefined);
    if (driveFileId && tombstone.driveFileId !== driveFileId) {
      tombstone.driveFileId = driveFileId;
      await Promise.all([
        upsertSyncTombstone(tombstone),
        setDoc(
          tombstoneDoc(uid, tombstone.id, db),
          { driveFileId },
          { merge: true }
        ),
      ]);
    }

    const [highlights, bookmarks] = await Promise.all([
      getDocs(collection(db, "users", uid, "books", tombstone.bookId, "highlights")),
      getDocs(collection(db, "users", uid, "books", tombstone.bookId, "bookmarks")),
    ]);
    await deleteRemoteRefs(db, [
      ...highlights.docs.map((item) => item.ref),
      ...bookmarks.docs.map((item) => item.ref),
      ref,
    ]);

    if (driveFileId) {
      await deleteBookFileFromDrive(driveFileId).catch(notifyDriveSyncError);
    }
    return;
  }

  const itemId = tombstone.itemId;
  if (!itemId) return;
  const childCollection =
    tombstone.entity === "highlight" ? "highlights" : "bookmarks";
  const ref = doc(
    db,
    "users",
    uid,
    "books",
    tombstone.bookId,
    childCollection,
    itemId
  );
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  const remoteUpdatedAt =
    typeof data.updatedAt === "number"
      ? data.updatedAt
      : typeof data.createdAt === "number"
        ? data.createdAt
        : 0;
  if (remoteUpdatedAt <= tombstone.deletedAt) {
    await deleteDoc(ref);
  }
}

async function queueRemoteTombstone(
  tombstone: SyncTombstone
): Promise<void> {
  await upsertSyncTombstone(tombstone);
  const db = getFirebaseDb();
  if (!db) return;
  void runTrackedSync(tombstone.uid, async () => {
      await setDoc(
        tombstoneDoc(tombstone.uid, tombstone.id, db),
        remoteTombstoneData(tombstone),
        { merge: true }
      );
      await pruneRemoteTombstone(tombstone.uid, tombstone, db);
    })
    .catch(console.error);
}

function readerSettingsSnapshot(): ReaderSettings {
  const settings = useSettingsStore.getState();
  return {
    theme: settings.theme,
    warmth: settings.warmth,
    brightness: settings.brightness,
    contrast: settings.contrast,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    margin: settings.margin,
    columns: settings.columns,
    columnsAutoManaged: settings.columnsAutoManaged,
    scrollMode: settings.scrollMode,
    volumeKeyPageTurn: settings.volumeKeyPageTurn,
    pageTurnAnimation: settings.pageTurnAnimation,
    autoNightMode: settings.autoNightMode,
    customBg: settings.customBg,
    customFg: settings.customFg,
  };
}

async function executeOutboxOperation(
  operation: SyncOutboxOperation,
  db: Firestore
): Promise<void> {
  const { uid, bookId, itemId } = operation;
  switch (operation.kind) {
    case "book": {
      if (!bookId) return;
      const book = await getBook(bookId);
      if (!book) return;
      await setDoc(
        bookDoc(uid, bookId, db),
        {
          title: book.title,
          author: book.author,
          format: book.format,
          addedAt: book.addedAt,
          fileSize: book.fileSize,
          category: book.category ?? null,
          updatedAt: book.updatedAt ?? book.addedAt,
        },
        { merge: true }
      );
      return;
    }
    case "progress": {
      if (!bookId) return;
      const progress = await getProgress(bookId);
      if (!progress) return;
      await setDoc(
        bookDoc(uid, bookId, db),
        {
          progress: {
            location: progress.location,
            percentage: progress.percentage,
            updatedAt: progress.updatedAt,
          },
          updatedAt: progress.updatedAt,
        },
        { merge: true }
      );
      return;
    }
    case "highlight": {
      if (!bookId || !itemId) return;
      const highlight = await getHighlight(itemId);
      if (!highlight || highlight.bookId !== bookId) return;
      await setDoc(
        doc(db, "users", uid, "books", bookId, "highlights", itemId),
        {
          ...highlight,
          updatedAt: highlight.updatedAt ?? highlight.createdAt,
        },
        { merge: true }
      );
      return;
    }
    case "bookmark": {
      if (!bookId || !itemId) return;
      const bookmark = await getBookmark(itemId);
      if (!bookmark || bookmark.bookId !== bookId) return;
      await setDoc(
        doc(db, "users", uid, "books", bookId, "bookmarks", itemId),
        {
          ...bookmark,
          updatedAt: bookmark.updatedAt ?? bookmark.createdAt,
        },
        { merge: true }
      );
      return;
    }
    case "settings": {
      await setDoc(
        doc(db, "users", uid, "settings", "reader"),
        { ...readerSettingsSnapshot(), updatedAt: Date.now() },
        { merge: true }
      );
      return;
    }
    case "drive-upload": {
      if (!bookId) return;
      const [book, fileBlob] = await Promise.all([
        getBook(bookId),
        getBookFile(bookId),
      ]);
      if (!book || !fileBlob) return;
      const fileId = await uploadBookFileToDrive(
        bookId,
        `${bookId}.${book.format}`,
        fileBlob
      );
      if (!fileId) {
        const pendingError = new Error("Drive upload is pending");
        Object.assign(pendingError, { code: "drive/unavailable" });
        throw pendingError;
      }
      await setDoc(
        bookDoc(uid, bookId, db),
        { driveFileId: fileId, updatedAt: Date.now() },
        { merge: true }
      );
      const latest = await getBook(bookId);
      if (latest) {
        await upsertBookMetadata({ ...latest, driveFileId: fileId });
      }
    }
  }
}

function scheduleOutboxDrain(uid: string, nextAttemptAt: number): void {
  const existing = outboxRetryTimers.get(uid);
  if (existing) clearTimeout(existing);
  const delay = Math.max(1_000, nextAttemptAt - Date.now());
  const timer = setTimeout(() => {
    outboxRetryTimers.delete(uid);
    void drainSyncOutbox(uid).catch(console.error);
  }, delay);
  outboxRetryTimers.set(uid, timer);
}

async function publishOutboxStatus(
  uid: string,
  phaseOverride?: "syncing"
): Promise<void> {
  const operations = await getSyncOutboxOperations(uid);
  const first = operations[0];
  const attentionOperation = operations.find(
    (operation) =>
      operation.lastErrorCode === "permission-denied" ||
      operation.lastErrorCode === "quota-exceeded"
  );
  useSyncStatusStore.getState().setStatus({
    uid,
    phase: phaseOverride
      ? phaseOverride
      : attentionOperation
        ? "attention"
        : operations.length
          ? "retrying"
          : "idle",
    pendingCount: operations.length,
    nextAttemptAt: first?.nextAttemptAt ?? null,
    lastErrorCode:
      attentionOperation?.lastErrorCode ?? first?.lastErrorCode ?? null,
  });
}

async function scheduleNextOutboxDrain(uid: string): Promise<void> {
  const [activeUid, configuredDb] = await Promise.all([
    currentUid(),
    Promise.resolve(getFirebaseDb()),
  ]);
  if (activeUid !== uid || !configuredDb) {
    const timer = outboxRetryTimers.get(uid);
    if (timer) clearTimeout(timer);
    outboxRetryTimers.delete(uid);
    return;
  }
  const remaining = await getSyncOutboxOperations(uid);
  if (!remaining.length) {
    const timer = outboxRetryTimers.get(uid);
    if (timer) clearTimeout(timer);
    outboxRetryTimers.delete(uid);
    return;
  }
  scheduleOutboxDrain(uid, remaining[0].nextAttemptAt);
}

export async function drainSyncOutbox(
  uid: string,
  options: { force?: boolean; database?: Firestore } = {}
): Promise<void> {
  const existing = outboxDrains.get(uid);
  if (existing) return existing;

  const drain = (async () => {
    const db = options.database ?? getFirebaseDb();
    if (!db) return;
    await publishOutboxStatus(uid, "syncing");
    await runTrackedSync(uid, async () => {
      const operations = await getSyncOutboxOperations(uid);
      for (const operation of operations) {
        const now = Date.now();
        if (!options.force && operation.nextAttemptAt > now) continue;
        try {
          await executeOutboxOperation(operation, db);
          await completeSyncOutboxOperation(
            operation.id,
            operation.updatedAt
          );
        } catch (error) {
          const attempts = operation.attempts + 1;
          await failSyncOutboxOperation(
            operation,
            classifySyncError(error),
            now + syncRetryDelayMs(attempts)
          );
          if (
            operation.kind === "drive-upload" &&
            operation.attempts === 0 &&
            error instanceof DriveSyncError
          ) {
            notifyDriveSyncError(error);
          }
        }
      }
    });
  })().finally(async () => {
    outboxDrains.delete(uid);
    await scheduleNextOutboxDrain(uid);
    await publishOutboxStatus(uid);
  });

  outboxDrains.set(uid, drain);
  return drain;
}

async function queueOutboxOperation(
  operation: SyncOutboxOperation
): Promise<void> {
  await upsertSyncOutboxOperation(operation);
  await publishOutboxStatus(operation.uid, "syncing");
  void drainSyncOutbox(operation.uid).catch(console.error);
}

export async function flushCurrentUserSyncOutbox(): Promise<void> {
  const uid = await currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await drainSyncOutbox(uid, { force: true, database: db });
  const tombstones = await getSyncTombstones(uid);
  await runTrackedSync(uid, async () => {
    for (const tombstone of newestTombstones(tombstones).values()) {
      await setDoc(
        tombstoneDoc(uid, tombstone.id, db),
        remoteTombstoneData(tombstone),
        { merge: true }
      );
      await pruneRemoteTombstone(uid, tombstone, db);
    }
  });
}

/**
 * Push a single book's metadata (and, if given, its progress) after a local
 * add/rename. No-ops when signed out or Firebase isn't configured — every
 * caller in lib/storage.ts fires this in the background and ignores
 * failures, so guest mode and offline use are never affected.
 */
export async function pushBook(book: Book, progress?: ReadingProgress): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueOutboxOperation(
    createSyncOutboxOperation(uid, "book", { bookId: book.id })
  );
  if (progress) await pushProgress(progress);
}

/** Push just the progress field for a book (reading position changed). */
export async function pushProgress(progress: ReadingProgress): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueOutboxOperation(
    createSyncOutboxOperation(uid, "progress", {
      bookId: progress.bookId,
    })
  );
}

/**
 * Turns a failed Drive call into a user-facing toast (the local book add/
 * delete has already completed by the time this runs — Drive is purely a
 * background backup layer, so a failure here is surfaced, not propagated).
 * Non-`DriveSyncError` failures (e.g. a Firestore write on the follow-up
 * `setDoc`) are logged only, since they aren't Drive-specific and don't yet
 * have their own user-facing copy.
 */
function notifyDriveSyncError(err: unknown): void {
  if (!(err instanceof DriveSyncError)) {
    console.error(err);
    return;
  }
  switch (err.kind) {
    case "quota_exceeded":
      toast.error(translate("drive.errorQuotaExceeded"));
      break;
    case "permission_denied":
      toast.error(translate("drive.errorPermissionDenied"));
      break;
    case "not_found":
      toast.error(translate("drive.errorNotFound"));
      break;
    case "network":
      toast.error(translate("drive.errorGeneric"));
      break;
  }
  console.error(err);
}

/**
 * Uploads a newly-added book's file to the user's hidden Drive app folder
 * and records the returned file id on its Firestore doc. Google-only (no-op
 * for email/password accounts, which have no Drive access token) — see
 * lib/drive-sync.ts. A Drive failure is surfaced as a toast and swallowed
 * here rather than thrown, so it never rolls back the local add.
 */
export async function syncBookFileToDrive(book: Book, fileBlob: Blob): Promise<void> {
  void fileBlob;
  const user = await currentUser();
  if (!user || !hasGoogleProvider(user)) return;
  await queueOutboxOperation(
    createSyncOutboxOperation(user.uid, "drive-upload", {
      bookId: book.id,
    })
  );
}

/** Queues a durable deletion marker, then prunes the older remote book tree. */
export async function deleteBookRemote(bookId: string): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueRemoteTombstone(createSyncTombstone(uid, "book", bookId));
}

export async function pushHighlight(highlight: Highlight): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueOutboxOperation(
    createSyncOutboxOperation(uid, "highlight", {
      bookId: highlight.bookId,
      itemId: highlight.id,
    })
  );
}

export async function deleteHighlightRemote(bookId: string, id: string): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueRemoteTombstone(createSyncTombstone(uid, "highlight", bookId, id));
}

export async function pushBookmark(bookmark: Bookmark): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueOutboxOperation(
    createSyncOutboxOperation(uid, "bookmark", {
      bookId: bookmark.bookId,
      itemId: bookmark.id,
    })
  );
}

export async function deleteBookmarkRemote(bookId: string, id: string): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueRemoteTombstone(createSyncTombstone(uid, "bookmark", bookId, id));
}

/** Push the current reader settings (called whenever they change while signed in). */
export async function pushSettingsSnapshot(): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  await queueOutboxOperation(createSyncOutboxOperation(uid, "settings"));
}

/**
 * Pushes the entire current local library (books, progress, highlights,
 * bookmarks, reader settings) to Firestore under this user's own subtree.
 * Safe to call repeatedly (e.g. once per sign-in) — every write uses
 * `merge: true` semantics via per-field `set`, so it never touches data
 * this device doesn't know about.
 *
 * Silently no-ops if Firebase isn't configured (no NEXT_PUBLIC_FIREBASE_*
 * env vars) — cloud sync is strictly opt-in on top of the local-first app.
 */
export async function pushLibrarySnapshot(uid: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await drainSyncOutbox(uid, { force: true, database: db });
  await runTrackedSync(uid, async () => {

  const [books, metadata, localTombstones] = await Promise.all([
    getAllBooks(),
    getAllMetadataForBackup(),
    getSyncTombstones(uid),
  ]);
  const progressByBook = new Map(metadata.progress.map((p) => [p.bookId, p]));
  const tombstones = newestTombstones(localTombstones);

  let batch = writeBatch(db);
  let opsInBatch = 0;
  const pendingBatches: ReturnType<typeof writeBatch>[] = [];

  const enqueue = (ref: ReturnType<typeof doc>, data: Record<string, unknown>) => {
    if (opsInBatch >= MAX_BATCH_OPS) {
      pendingBatches.push(batch);
      batch = writeBatch(db);
      opsInBatch = 0;
    }
    batch.set(ref, data, { merge: true });
    opsInBatch++;
  };

  for (const tombstone of tombstones.values()) {
    enqueue(
      tombstoneDoc(uid, tombstone.id, db),
      remoteTombstoneData(tombstone)
    );
  }

  for (const book of books) {
    const bookTombstone = tombstones.get(syncTombstoneId("book", book.id));
    const bookUpdatedAt = book.updatedAt ?? book.addedAt;
    if (tombstoneCovers(bookTombstone, bookUpdatedAt)) continue;
    const progress = progressByBook.get(book.id);
    enqueue(doc(db, "users", uid, "books", book.id), {
      title: book.title,
      author: book.author,
      format: book.format,
      addedAt: book.addedAt,
      fileSize: book.fileSize,
      category: book.category ?? null,
      progress: progress
        ? { location: progress.location, percentage: progress.percentage, updatedAt: progress.updatedAt }
        : null,
      updatedAt: bookUpdatedAt,
    });
  }

  for (const highlight of metadata.highlights) {
    const updatedAt = highlight.updatedAt ?? highlight.createdAt;
    if (
      tombstoneCovers(
        tombstones.get(syncTombstoneId("book", highlight.bookId)),
        updatedAt
      ) ||
      tombstoneCovers(
        tombstones.get(
          syncTombstoneId("highlight", highlight.bookId, highlight.id)
        ),
        updatedAt
      )
    ) {
      continue;
    }
    enqueue(
      doc(db, "users", uid, "books", highlight.bookId, "highlights", highlight.id),
      { ...highlight, updatedAt }
    );
  }

  for (const bookmark of metadata.bookmarks) {
    const updatedAt = bookmark.updatedAt ?? bookmark.createdAt;
    if (
      tombstoneCovers(
        tombstones.get(syncTombstoneId("book", bookmark.bookId)),
        updatedAt
      ) ||
      tombstoneCovers(
        tombstones.get(
          syncTombstoneId("bookmark", bookmark.bookId, bookmark.id)
        ),
        updatedAt
      )
    ) {
      continue;
    }
    enqueue(
      doc(db, "users", uid, "books", bookmark.bookId, "bookmarks", bookmark.id),
      { ...bookmark, updatedAt }
    );
  }

  enqueue(doc(db, "users", uid, "settings", "reader"), {
    ...readerSettingsSnapshot(),
    updatedAt: Date.now(),
  });

  pendingBatches.push(batch);
  for (const b of pendingBatches) await b.commit();
  for (const tombstone of tombstones.values()) {
    await pruneRemoteTombstone(uid, tombstone, db);
  }
  });
}

interface RemoteBookDoc {
  title: string;
  author: string;
  format: BookFormat;
  addedAt: number;
  fileSize: number;
  category: string | null;
  driveFileId?: string;
  updatedAt: number;
  progress?: { location: string; percentage: number; updatedAt: number } | null;
}

interface RemoteHighlightDoc {
  location: string;
  text: string;
  color: string;
  importance: Highlight["importance"];
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface RemoteBookmarkDoc {
  location: string;
  label: string;
  createdAt: number;
  updatedAt?: number;
}

interface RemoteTombstoneDoc {
  entity: SyncTombstone["entity"];
  bookId: string;
  itemId?: string | null;
  driveFileId?: string | null;
  deletedAt: number;
  serverDeletedAt?: unknown;
}

/**
 * Pulls this user's Firestore library down into local IndexedDB — the
 * counterpart to `pushLibrarySnapshot`, run right after it on sign-in.
 * Per item (book, progress, highlight), only overwrites the local copy when
 * the remote `updatedAt` is strictly newer than the local one, so it never
 * clobbers changes this device already made (and already pushed moments
 * earlier). Bookmarks are immutable once created, so they're simply
 * inserted if missing locally — no timestamp comparison needed.
 *
 * Metadata-only: a pulled book's actual file is fetched from Google Drive
 * lazily, the first time it's opened (see
 * components/reader/useReaderBootstrap.ts) — this never downloads book
 * files itself. Tombstones are pulled and applied before live records, so a
 * stale snapshot cannot recreate an older deleted item.
 *
 * Silently no-ops if Firebase isn't configured, same as `pushLibrarySnapshot`.
 */
export async function pullLibrarySnapshot(
  uid: string,
  database?: Firestore
): Promise<void> {
  const db = database ?? getFirebaseDb();
  if (!db) return;
  await runTrackedSync(uid, async () => {

  const [remoteTombstoneDocs, localTombstones] = await Promise.all([
    getDocs(collection(db, "users", uid, "tombstones")),
    getSyncTombstones(uid),
  ]);
  const remoteTombstones = remoteTombstoneDocs.docs.flatMap((snapshot) => {
    const data = snapshot.data() as RemoteTombstoneDoc;
    if (
      !["book", "highlight", "bookmark"].includes(data.entity) ||
      typeof data.bookId !== "string" ||
      typeof data.deletedAt !== "number"
    ) {
      return [];
    }
    const serverDeletedAt = timestampMillis(data.serverDeletedAt);
    return [{
      id: snapshot.id,
      uid,
      entity: data.entity,
      bookId: data.bookId,
      ...(typeof data.itemId === "string" ? { itemId: data.itemId } : {}),
      ...(typeof data.driveFileId === "string"
        ? { driveFileId: data.driveFileId }
        : {}),
      deletedAt: Math.max(data.deletedAt, serverDeletedAt ?? 0),
    } satisfies SyncTombstone];
  });
  await Promise.all(remoteTombstones.map(upsertSyncTombstone));
  const tombstones = newestTombstones([
    ...localTombstones,
    ...remoteTombstones,
  ]);

  for (const tombstone of tombstones.values()) {
    if (tombstone.entity === "book") {
      const local = await getBook(tombstone.bookId);
      if (
        local &&
        tombstoneCovers(tombstone, local.updatedAt ?? local.addedAt)
      ) {
        await deleteBookLocal(tombstone.bookId);
      }
      continue;
    }

    if (!tombstone.itemId) continue;
    if (tombstone.entity === "highlight") {
      const local = await getHighlight(tombstone.itemId);
      if (
        local &&
        tombstoneCovers(tombstone, local.updatedAt ?? local.createdAt)
      ) {
        await deleteHighlightLocal(tombstone.itemId);
      }
      continue;
    }

    const local = await getBookmark(tombstone.itemId);
    if (
      local &&
      tombstoneCovers(tombstone, local.updatedAt ?? local.createdAt)
    ) {
      await deleteBookmarkLocal(tombstone.itemId);
    }
  }

  const bookDocs = await getDocs(collection(db, "users", uid, "books"));

  await Promise.all(
    bookDocs.docs.map(async (snapshot) => {
      const remote = snapshot.data() as RemoteBookDoc;
      const bookId = snapshot.id;
      if (
        typeof remote.title !== "string" ||
        typeof remote.author !== "string" ||
        (remote.format !== "epub" && remote.format !== "pdf") ||
        typeof remote.addedAt !== "number" ||
        typeof remote.fileSize !== "number" ||
        typeof remote.updatedAt !== "number"
      ) {
        return;
      }
      if (
        tombstoneCovers(
          tombstones.get(syncTombstoneId("book", bookId)),
          remote.updatedAt
        )
      ) {
        return;
      }
      const local = await getBook(bookId);

      if (!local || (local.updatedAt ?? 0) < remote.updatedAt) {
        const book: Book = {
          id: bookId,
          title: remote.title,
          author: remote.author,
          format: remote.format,
          addedAt: remote.addedAt,
          fileSize: remote.fileSize,
          category: remote.category ?? undefined,
          driveFileId: remote.driveFileId,
          updatedAt: remote.updatedAt,
        };
        await upsertBookMetadata(book);
      }

      if (remote.progress) {
        const localProgress = await getProgress(bookId);
        if (!localProgress || localProgress.updatedAt < remote.progress.updatedAt) {
          await upsertProgressLocal({
            bookId,
            location: remote.progress.location,
            percentage: remote.progress.percentage,
            updatedAt: remote.progress.updatedAt,
          });
        }
      }

      const [highlightDocs, bookmarkDocs, localHighlights, localBookmarks] = await Promise.all([
        getDocs(collection(db, "users", uid, "books", bookId, "highlights")),
        getDocs(collection(db, "users", uid, "books", bookId, "bookmarks")),
        getHighlights(bookId),
        getBookmarks(bookId),
      ]);
      const localHighlightsById = new Map(localHighlights.map((h) => [h.id, h]));
      const localBookmarksById = new Map(localBookmarks.map((b) => [b.id, b]));

      await Promise.all([
        ...highlightDocs.docs.map(async (hSnap) => {
          const remoteH = hSnap.data() as RemoteHighlightDoc;
          if (
            tombstoneCovers(
              tombstones.get(
                syncTombstoneId("highlight", bookId, hSnap.id)
              ),
              remoteH.updatedAt
            )
          ) {
            return;
          }
          const localH = localHighlightsById.get(hSnap.id);
          if (localH && (localH.updatedAt ?? 0) >= remoteH.updatedAt) return;
          await upsertHighlightLocal({
            id: hSnap.id,
            bookId,
            location: remoteH.location,
            text: remoteH.text,
            color: remoteH.color,
            importance: remoteH.importance,
            note: remoteH.note,
            createdAt: remoteH.createdAt,
            updatedAt: remoteH.updatedAt,
          });
        }),
        ...bookmarkDocs.docs.map(async (bSnap) => {
            const remoteB = bSnap.data() as RemoteBookmarkDoc;
            const remoteUpdatedAt = remoteB.updatedAt ?? remoteB.createdAt;
            if (
              tombstoneCovers(
                tombstones.get(
                  syncTombstoneId("bookmark", bookId, bSnap.id)
                ),
                remoteUpdatedAt
              )
            ) {
              return;
            }
            const localB = localBookmarksById.get(bSnap.id);
            if (
              localB &&
              (localB.updatedAt ?? localB.createdAt) >= remoteUpdatedAt
            ) {
              return;
            }
            await upsertBookmarkLocal({
              id: bSnap.id,
              bookId,
              location: remoteB.location,
              label: remoteB.label,
              createdAt: remoteB.createdAt,
              updatedAt: remoteUpdatedAt,
            });
          }),
      ]);
    })
  );

  const settingsSnap = await getDoc(doc(db, "users", uid, "settings", "reader"));
  if (settingsSnap.exists()) {
    useSettingsStore.setState(settingsSnap.data() as ReaderSettings);
  }

  // So a library screen already open at sign-in shows the newly-pulled
  // books immediately, instead of waiting for some unrelated refresh.
  // Dynamic import to dodge a static import cycle: useLibraryStore pulls in
  // lib/storage.ts, which dynamically imports *this* module for its own
  // push side effects (same reasoning as those `import("./cloud-sync")`
  // calls in storage.ts).
  const { useLibraryStore } = await import("@/store/useLibraryStore");
  await useLibraryStore.getState().refresh();
  });
}
