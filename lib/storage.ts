import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Book,
  BookCover,
  BookFile,
  Bookmark,
  DriveUploadSession,
  Highlight,
  ReadingProgress,
  ReadingStatDay,
  SyncOutboxOperation,
  SyncTombstone,
} from "./types";

const DB_NAME = "epub-reader";
const DB_VERSION = 6;

interface ReaderDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { "by-addedAt": number };
  };
  files: {
    key: string;
    value: BookFile;
  };
  covers: {
    key: string;
    value: BookCover;
  };
  progress: {
    key: string;
    value: ReadingProgress;
  };
  highlights: {
    key: string;
    value: Highlight;
    indexes: { "by-book": string };
  };
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: { "by-book": string };
  };
  readingStats: {
    key: string;
    value: ReadingStatDay;
  };
  driveUploadSessions: {
    key: string;
    value: DriveUploadSession;
  };
  syncTombstones: {
    key: string;
    value: SyncTombstone;
    indexes: { "by-uid": string };
  };
  syncOutbox: {
    key: string;
    value: SyncOutboxOperation;
    indexes: { "by-uid": string; "by-next-at": number };
  };
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("storage.ts can only be used in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<ReaderDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const books = db.createObjectStore("books", { keyPath: "id" });
          books.createIndex("by-addedAt", "addedAt");
          db.createObjectStore("files", { keyPath: "bookId" });
          db.createObjectStore("covers", { keyPath: "bookId" });
          db.createObjectStore("progress", { keyPath: "bookId" });
        }
        if (oldVersion < 2) {
          const highlights = db.createObjectStore("highlights", { keyPath: "id" });
          highlights.createIndex("by-book", "bookId");
          const bookmarks = db.createObjectStore("bookmarks", { keyPath: "id" });
          bookmarks.createIndex("by-book", "bookId");
        }
        if (oldVersion < 3) {
          db.createObjectStore("readingStats", { keyPath: "date" });
        }
        if (oldVersion < 4) {
          db.createObjectStore("driveUploadSessions", { keyPath: "bookId" });
        }
        if (oldVersion < 5) {
          const tombstones = db.createObjectStore("syncTombstones", { keyPath: "id" });
          tombstones.createIndex("by-uid", "uid");
        }
        if (oldVersion < 6) {
          const outbox = db.createObjectStore("syncOutbox", { keyPath: "id" });
          outbox.createIndex("by-uid", "uid");
          outbox.createIndex("by-next-at", "nextAttemptAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function addBook(
  book: Book,
  fileBlob: Blob,
  coverBlob?: Blob
): Promise<void> {
  const db = await getDB();
  const stamped: Book = { ...book, updatedAt: Date.now() };
  const tx = db.transaction(["books", "files", "covers"], "readwrite");
  await tx.objectStore("books").put(stamped);
  await tx.objectStore("files").put({ bookId: book.id, blob: fileBlob });
  if (coverBlob) {
    await tx.objectStore("covers").put({ bookId: book.id, blob: coverBlob });
  }
  await tx.done;
  await import("./cloud-sync").then((m) => m.pushBook(stamped)).catch(console.error);
  await import("./cloud-sync")
    .then((m) => m.syncBookFileToDrive(stamped, fileBlob))
    .catch(console.error);
}

/**
 * Writes (or overwrites) a book's file blob directly — the same `files`
 * store write `addBook` does, split out so the reader's lazy Drive-download
 * fallback (see components/reader/useReaderBootstrap.ts) can save a
 * just-downloaded file without re-running the rest of `addBook`.
 */
export async function saveBookFile(bookId: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("files", { bookId, blob });
}

/**
 * Writes (or overwrites) a book's cover blob directly — used to backfill a
 * cover for a pulled book once its file is lazily downloaded from Drive and
 * re-parsed for its cover image (a pulled book has no cover until then,
 * since covers aren't synced to Firestore/Drive, only extracted locally from
 * the file itself).
 */
export async function saveBookCover(bookId: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("covers", { bookId, blob });
}

/**
 * Writes book metadata pulled from Firestore straight into the `books`
 * store, without touching `files`/`covers` (the pull is metadata-only; the
 * file itself is fetched from Drive lazily, on first open — see
 * useReaderBootstrap.ts) and without pushing back to Firestore (we just read
 * this from there).
 */
export async function upsertBookMetadata(book: Book): Promise<void> {
  const db = await getDB();
  await db.put("books", book);
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB();
  const books = await db.getAllFromIndex("books", "by-addedAt");
  return books.reverse();
}

export async function getBook(bookId: string): Promise<Book | undefined> {
  const db = await getDB();
  return db.get("books", bookId);
}

export async function getBookFile(bookId: string): Promise<Blob | undefined> {
  const db = await getDB();
  const record = await db.get("files", bookId);
  return record?.blob;
}

export async function getBookCover(bookId: string): Promise<Blob | undefined> {
  const db = await getDB();
  const record = await db.get("covers", bookId);
  return record?.blob;
}

/**
 * Reads/writes the in-flight Google Drive resumable-upload session for a
 * book id, if any — lets an interrupted upload (network drop, app
 * backgrounded/killed mid-transfer) resume instead of restarting from byte
 * 0. See lib/drive-sync.ts, which owns the actual Drive protocol calls.
 */
export async function getDriveUploadSession(bookId: string): Promise<DriveUploadSession | undefined> {
  const db = await getDB();
  return db.get("driveUploadSessions", bookId);
}

export async function saveDriveUploadSession(session: DriveUploadSession): Promise<void> {
  const db = await getDB();
  await db.put("driveUploadSessions", session);
}

export async function deleteDriveUploadSession(bookId: string): Promise<void> {
  const db = await getDB();
  await db.delete("driveUploadSessions", bookId);
}

export async function updateBook(
  bookId: string,
  patch: Partial<Pick<Book, "title" | "author" | "category">>
): Promise<Book | undefined> {
  const db = await getDB();
  const existing = await db.get("books", bookId);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put("books", updated);
  await import("./cloud-sync").then((m) => m.pushBook(updated)).catch(console.error);
  return updated;
}

export async function deleteBookLocal(
  bookId: string
): Promise<{ highlightIds: string[]; bookmarkIds: string[] }> {
  const db = await getDB();
  const tx = db.transaction(
    ["books", "files", "covers", "progress", "highlights", "bookmarks", "driveUploadSessions"],
    "readwrite"
  );
  await tx.objectStore("books").delete(bookId);
  await tx.objectStore("files").delete(bookId);
  await tx.objectStore("covers").delete(bookId);
  await tx.objectStore("progress").delete(bookId);
  await tx.objectStore("driveUploadSessions").delete(bookId);
  const highlightIds = (
    await tx.objectStore("highlights").index("by-book").getAllKeys(bookId)
  ) as string[];
  for (const h of highlightIds) {
    await tx.objectStore("highlights").delete(h);
  }
  const bookmarkIds = (
    await tx.objectStore("bookmarks").index("by-book").getAllKeys(bookId)
  ) as string[];
  for (const b of bookmarkIds) {
    await tx.objectStore("bookmarks").delete(b);
  }
  await tx.done;
  return { highlightIds, bookmarkIds };
}

export async function deleteBook(bookId: string): Promise<void> {
  await deleteBookLocal(bookId);
  await import("./cloud-sync")
    .then((m) => m.deleteBookRemote(bookId))
    .catch(console.error);
}

export async function getProgress(
  bookId: string
): Promise<ReadingProgress | undefined> {
  const db = await getDB();
  return db.get("progress", bookId);
}

export async function setProgress(progress: ReadingProgress): Promise<void> {
  const db = await getDB();
  await db.put("progress", progress);
  await import("./cloud-sync").then((m) => m.pushProgress(progress)).catch(console.error);
}

/** Writes reading progress pulled from Firestore, without pushing back — see upsertBookMetadata. */
export async function upsertProgressLocal(progress: ReadingProgress): Promise<void> {
  const db = await getDB();
  await db.put("progress", progress);
}

export async function addHighlight(highlight: Highlight): Promise<void> {
  const db = await getDB();
  const stamped: Highlight = { ...highlight, updatedAt: Date.now() };
  await db.put("highlights", stamped);
  await import("./cloud-sync").then((m) => m.pushHighlight(stamped)).catch(console.error);
}

/** Writes a highlight pulled from Firestore, without pushing back — see upsertBookMetadata. */
export async function upsertHighlightLocal(highlight: Highlight): Promise<void> {
  const db = await getDB();
  await db.put("highlights", highlight);
}

export async function getHighlights(bookId: string): Promise<Highlight[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("highlights", "by-book", bookId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getHighlight(id: string): Promise<Highlight | undefined> {
  const db = await getDB();
  return db.get("highlights", id);
}

export async function updateHighlight(
  id: string,
  patch: Partial<Pick<Highlight, "note" | "color" | "importance">>
): Promise<Highlight | undefined> {
  const db = await getDB();
  const existing = await db.get("highlights", id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put("highlights", updated);
  await import("./cloud-sync").then((m) => m.pushHighlight(updated)).catch(console.error);
  return updated;
}

export async function deleteHighlightLocal(id: string): Promise<Highlight | undefined> {
  const db = await getDB();
  const existing = await db.get("highlights", id);
  await db.delete("highlights", id);
  return existing;
}

export async function deleteHighlight(id: string): Promise<void> {
  const existing = await deleteHighlightLocal(id);
  if (existing) {
    await import("./cloud-sync")
      .then((m) => m.deleteHighlightRemote(existing.bookId, id))
      .catch(console.error);
  }
}

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const db = await getDB();
  const stamped: Bookmark = { ...bookmark, updatedAt: Date.now() };
  await db.put("bookmarks", stamped);
  await import("./cloud-sync").then((m) => m.pushBookmark(stamped)).catch(console.error);
}

/**
 * Writes a bookmark pulled from Firestore, without pushing back. Bookmarks
 * are immutable once created (no update path), so pull only ever inserts
 * ones missing locally — no updatedAt comparison needed.
 */
export async function upsertBookmarkLocal(bookmark: Bookmark): Promise<void> {
  const db = await getDB();
  await db.put("bookmarks", bookmark);
}

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("bookmarks", "by-book", bookId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getBookmark(id: string): Promise<Bookmark | undefined> {
  const db = await getDB();
  return db.get("bookmarks", id);
}

export async function deleteBookmarkLocal(id: string): Promise<Bookmark | undefined> {
  const db = await getDB();
  const existing = await db.get("bookmarks", id);
  await db.delete("bookmarks", id);
  return existing;
}

export async function deleteBookmark(id: string): Promise<void> {
  const existing = await deleteBookmarkLocal(id);
  if (existing) {
    await import("./cloud-sync")
      .then((m) => m.deleteBookmarkRemote(existing.bookId, id))
      .catch(console.error);
  }
}

export async function upsertSyncTombstone(tombstone: SyncTombstone): Promise<void> {
  const db = await getDB();
  const existing = await db.get("syncTombstones", tombstone.id);
  if (!existing || existing.deletedAt <= tombstone.deletedAt) {
    await db.put("syncTombstones", {
      ...existing,
      ...tombstone,
      driveFileId: tombstone.driveFileId ?? existing?.driveFileId,
    });
  }
}

export async function getSyncTombstones(uid: string): Promise<SyncTombstone[]> {
  const db = await getDB();
  return db.getAllFromIndex("syncTombstones", "by-uid", uid);
}

export async function upsertSyncOutboxOperation(
  operation: SyncOutboxOperation
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("syncOutbox", operation.id);
  await db.put("syncOutbox", {
    ...operation,
    createdAt: existing?.createdAt ?? operation.createdAt,
    updatedAt: Math.max(
      operation.updatedAt,
      (existing?.updatedAt ?? 0) + 1
    ),
  });
}

export async function getSyncOutboxOperations(
  uid: string
): Promise<SyncOutboxOperation[]> {
  const db = await getDB();
  const operations = await db.getAllFromIndex("syncOutbox", "by-uid", uid);
  return operations.sort(
    (a, b) =>
      a.nextAttemptAt - b.nextAttemptAt ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id)
  );
}

export async function completeSyncOutboxOperation(
  id: string,
  attemptedUpdatedAt: number
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("syncOutbox", "readwrite");
  const existing = await tx.store.get(id);
  if (existing && existing.updatedAt <= attemptedUpdatedAt) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function failSyncOutboxOperation(
  attempted: SyncOutboxOperation,
  lastErrorCode: string,
  nextAttemptAt: number
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("syncOutbox", "readwrite");
  const existing = await tx.store.get(attempted.id);
  if (existing?.updatedAt === attempted.updatedAt) {
    await tx.store.put({
      ...existing,
      attempts: existing.attempts + 1,
      nextAttemptAt,
      lastErrorCode,
    });
  }
  await tx.done;
}

export async function clearSyncStateForUid(uid: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["syncTombstones", "syncOutbox"], "readwrite");
  const [tombstoneKeys, outboxKeys] = await Promise.all([
    tx.objectStore("syncTombstones").index("by-uid").getAllKeys(uid),
    tx.objectStore("syncOutbox").index("by-uid").getAllKeys(uid),
  ]);
  for (const key of tombstoneKeys) {
    await tx.objectStore("syncTombstones").delete(key);
  }
  for (const key of outboxKeys) {
    await tx.objectStore("syncOutbox").delete(key);
  }
  await tx.done;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds minutes to today's reading total (local calendar day). */
export async function addReadingMinutes(minutes: number): Promise<void> {
  if (minutes <= 0) return;
  const db = await getDB();
  const date = localDateKey(new Date());
  const existing = await db.get("readingStats", date);
  await db.put("readingStats", { date, minutes: (existing?.minutes ?? 0) + minutes });
}

export interface LibraryMetadataDump {
  progress: ReadingProgress[];
  highlights: Highlight[];
  bookmarks: Bookmark[];
  readingStats: ReadingStatDay[];
}

/** Everything except book/cover files themselves (those are read separately, per book, as blobs). */
export async function getAllMetadataForBackup(): Promise<LibraryMetadataDump> {
  const db = await getDB();
  const [progress, highlights, bookmarks, readingStats] = await Promise.all([
    db.getAll("progress"),
    db.getAll("highlights"),
    db.getAll("bookmarks"),
    db.getAll("readingStats"),
  ]);
  return { progress, highlights, bookmarks, readingStats };
}

/** Restores non-file records from a backup. Books/files/covers go through addBook() instead. */
export async function importMetadata(dump: LibraryMetadataDump): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["progress", "highlights", "bookmarks", "readingStats"], "readwrite");
  for (const p of dump.progress) await tx.objectStore("progress").put(p);
  for (const h of dump.highlights) await tx.objectStore("highlights").put(h);
  for (const b of dump.bookmarks) await tx.objectStore("bookmarks").put(b);
  for (const r of dump.readingStats) await tx.objectStore("readingStats").put(r);
  await tx.done;
}

/** Last `days` calendar days (oldest first, ending today), zero-filled for days with no reading. */
export async function getRecentReadingStats(days: number): Promise<ReadingStatDay[]> {
  const db = await getDB();
  const all = await db.getAll("readingStats");
  const byDate = new Map(all.map((r) => [r.date, r.minutes]));
  const result: ReadingStatDay[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = localDateKey(d);
    result.push({ date, minutes: byDate.get(date) ?? 0 });
  }
  return result;
}

/** Clears every IndexedDB store while keeping the database ready for guest use. */
export async function clearLocalLibraryData(): Promise<void> {
  const db = await getDB();
  const stores = [
    "books",
    "files",
    "covers",
    "progress",
    "highlights",
    "bookmarks",
    "readingStats",
    "driveUploadSessions",
    "syncTombstones",
    "syncOutbox",
  ] as const;
  const tx = db.transaction(stores, "readwrite");
  await Promise.all(stores.map((store) => tx.objectStore(store).clear()));
  await tx.done;
}
