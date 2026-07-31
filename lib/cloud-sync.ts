// Two-way sync between the local IndexedDB library and Firestore:
// `push*`/`*Remote` send local changes up; `pullLibrarySnapshot` brings down
// whatever this device doesn't have yet or is behind on (per-item
// last-write-wins via `updatedAt`), called right after sign-in alongside the
// push. See PROJECT_DOCUMENTATION.md § Faz F for the full design and its
// known v1 limitation: deletions don't propagate on pull (no tombstones
// yet) — a book removed on one device stays put on another until deleted
// there too.
//
// Book files themselves are never part of this — only metadata lives in
// Firestore. The actual EPUB/PDF blob is fetched from Google Drive lazily,
// the first time a pulled book is opened (see
// components/reader/useReaderBootstrap.ts).
//
// Schema: users/{uid}/books/{bookId} (book metadata + its progress merged
// in), users/{uid}/books/{bookId}/highlights/{id}, .../bookmarks/{id}, and
// users/{uid}/settings/reader.
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import {
  getAllBooks,
  getAllMetadataForBackup,
  getBook,
  getBookmarks,
  getHighlights,
  getProgress,
  upsertBookMetadata,
  upsertBookmarkLocal,
  upsertHighlightLocal,
  upsertProgressLocal,
} from "./storage";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { DriveSyncError, deleteBookFileFromDrive, uploadBookFileToDrive } from "./drive-sync";
import { translate } from "./i18n/useTranslation";
import { toast } from "@/store/useToastStore";
import type { Book, BookFormat, Bookmark, Highlight, ReaderSettings, ReadingProgress } from "./types";

const MAX_BATCH_OPS = 450; // Firestore's actual limit is 500 — leave headroom.

function currentUid(): string | null {
  return useAuthStore.getState().user?.uid ?? null;
}

function bookDoc(uid: string, bookId: string, db: NonNullable<ReturnType<typeof getFirebaseDb>>) {
  return doc(db, "users", uid, "books", bookId);
}

/**
 * Push a single book's metadata (and, if given, its progress) after a local
 * add/rename. No-ops when signed out or Firebase isn't configured — every
 * caller in lib/storage.ts fires this in the background and ignores
 * failures, so guest mode and offline use are never affected.
 */
export async function pushBook(book: Book, progress?: ReadingProgress): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    bookDoc(uid, book.id, db),
    {
      title: book.title,
      author: book.author,
      format: book.format,
      addedAt: book.addedAt,
      fileSize: book.fileSize,
      category: book.category ?? null,
      ...(progress
        ? {
            progress: {
              location: progress.location,
              percentage: progress.percentage,
              updatedAt: progress.updatedAt,
            },
          }
        : {}),
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

/** Push just the progress field for a book (reading position changed). */
export async function pushProgress(progress: ReadingProgress): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    bookDoc(uid, progress.bookId, db),
    {
      progress: {
        location: progress.location,
        percentage: progress.percentage,
        updatedAt: progress.updatedAt,
      },
      updatedAt: Date.now(),
    },
    { merge: true }
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
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  const filename = `${book.id}.${book.format}`;
  let fileId: string | null;
  try {
    fileId = await uploadBookFileToDrive(book.id, filename, fileBlob);
  } catch (err) {
    notifyDriveSyncError(err);
    return;
  }
  if (!fileId) return;
  await setDoc(bookDoc(uid, book.id, db), { driveFileId: fileId, updatedAt: Date.now() }, { merge: true });
  // Mirror the file id onto the local book row too, so this same device
  // already knows it (and can re-download from Drive if its local file
  // blob is ever lost) without waiting for a future pull.
  const local = await getBook(book.id);
  if (local) await upsertBookMetadata({ ...local, driveFileId: fileId });
}

/** Removes a book (and, best-effort, its known highlight/bookmark docs, and its Drive file) from Firestore. */
export async function deleteBookRemote(
  bookId: string,
  highlightIds: string[] = [],
  bookmarkIds: string[] = []
): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  const ref = bookDoc(uid, bookId, db);
  const snapshot = await getDoc(ref);
  const driveFileId = snapshot.data()?.driveFileId as string | undefined;
  await Promise.all([
    deleteDoc(ref),
    ...highlightIds.map((id) => deleteDoc(doc(db, "users", uid, "books", bookId, "highlights", id))),
    ...bookmarkIds.map((id) => deleteDoc(doc(db, "users", uid, "books", bookId, "bookmarks", id))),
    // Drive delete already treats "not found" as success (see drive-sync.ts); a real failure here is
    // surfaced as a toast rather than rejecting this Promise.all, so the Firestore deletes above still land.
    driveFileId ? deleteBookFileFromDrive(driveFileId).catch(notifyDriveSyncError) : Promise.resolve(),
  ]);
}

export async function pushHighlight(highlight: Highlight): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    doc(db, "users", uid, "books", highlight.bookId, "highlights", highlight.id),
    { ...highlight, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function deleteHighlightRemote(bookId: string, id: string): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await deleteDoc(doc(db, "users", uid, "books", bookId, "highlights", id));
}

export async function pushBookmark(bookmark: Bookmark): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await setDoc(
    doc(db, "users", uid, "books", bookmark.bookId, "bookmarks", bookmark.id),
    { ...bookmark, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function deleteBookmarkRemote(bookId: string, id: string): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  await deleteDoc(doc(db, "users", uid, "books", bookId, "bookmarks", id));
}

/** Push the current reader settings (called whenever they change while signed in). */
export async function pushSettingsSnapshot(): Promise<void> {
  const uid = currentUid();
  const db = getFirebaseDb();
  if (!uid || !db) return;
  const s = useSettingsStore.getState();
  const settings: ReaderSettings = {
    theme: s.theme,
    warmth: s.warmth,
    brightness: s.brightness,
    contrast: s.contrast,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    margin: s.margin,
    columns: s.columns,
    columnsAutoManaged: s.columnsAutoManaged,
    scrollMode: s.scrollMode,
    volumeKeyPageTurn: s.volumeKeyPageTurn,
    pageTurnAnimation: s.pageTurnAnimation,
    autoNightMode: s.autoNightMode,
    customBg: s.customBg,
    customFg: s.customFg,
  };
  await setDoc(doc(db, "users", uid, "settings", "reader"), { ...settings, updatedAt: Date.now() }, { merge: true });
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

  const [books, metadata] = await Promise.all([getAllBooks(), getAllMetadataForBackup()]);
  const progressByBook = new Map(metadata.progress.map((p) => [p.bookId, p]));

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

  for (const book of books) {
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
      updatedAt: Date.now(),
    });
  }

  for (const highlight of metadata.highlights) {
    enqueue(
      doc(db, "users", uid, "books", highlight.bookId, "highlights", highlight.id),
      { ...highlight, updatedAt: Date.now() }
    );
  }

  for (const bookmark of metadata.bookmarks) {
    enqueue(
      doc(db, "users", uid, "books", bookmark.bookId, "bookmarks", bookmark.id),
      { ...bookmark, updatedAt: Date.now() }
    );
  }

  const s = useSettingsStore.getState();
  const settings: ReaderSettings = {
    theme: s.theme,
    warmth: s.warmth,
    brightness: s.brightness,
    contrast: s.contrast,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    margin: s.margin,
    columns: s.columns,
    columnsAutoManaged: s.columnsAutoManaged,
    scrollMode: s.scrollMode,
    volumeKeyPageTurn: s.volumeKeyPageTurn,
    pageTurnAnimation: s.pageTurnAnimation,
    autoNightMode: s.autoNightMode,
    customBg: s.customBg,
    customFg: s.customFg,
  };
  enqueue(doc(db, "users", uid, "settings", "reader"), {
    ...settings,
    updatedAt: Date.now(),
  });

  pendingBatches.push(batch);
  for (const b of pendingBatches) await b.commit();
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
 * files itself. Deletions are **not** synced (known v1 limitation, see the
 * module comment above) — a book/highlight/bookmark removed on another
 * device is not removed here.
 *
 * Silently no-ops if Firebase isn't configured, same as `pushLibrarySnapshot`.
 */
export async function pullLibrarySnapshot(uid: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;

  const bookDocs = await getDocs(collection(db, "users", uid, "books"));

  await Promise.all(
    bookDocs.docs.map(async (snapshot) => {
      const remote = snapshot.data() as RemoteBookDoc;
      const bookId = snapshot.id;
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
      const localBookmarkIds = new Set(localBookmarks.map((b) => b.id));

      await Promise.all([
        ...highlightDocs.docs.map(async (hSnap) => {
          const remoteH = hSnap.data() as RemoteHighlightDoc;
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
        ...bookmarkDocs.docs
          .filter((bSnap) => !localBookmarkIds.has(bSnap.id))
          .map(async (bSnap) => {
            const remoteB = bSnap.data() as RemoteBookmarkDoc;
            await upsertBookmarkLocal({
              id: bSnap.id,
              bookId,
              location: remoteB.location,
              label: remoteB.label,
              createdAt: remoteB.createdAt,
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
}
