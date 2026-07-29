import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Book,
  BookCover,
  BookFile,
  Bookmark,
  Highlight,
  ReadingProgress,
  ReadingStatDay,
} from "./types";

const DB_NAME = "epub-reader";
const DB_VERSION = 3;

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
  const tx = db.transaction(["books", "files", "covers"], "readwrite");
  await tx.objectStore("books").put(book);
  await tx.objectStore("files").put({ bookId: book.id, blob: fileBlob });
  if (coverBlob) {
    await tx.objectStore("covers").put({ bookId: book.id, blob: coverBlob });
  }
  await tx.done;
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

export async function updateBook(
  bookId: string,
  patch: Partial<Pick<Book, "title" | "author" | "category">>
): Promise<Book | undefined> {
  const db = await getDB();
  const existing = await db.get("books", bookId);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  await db.put("books", updated);
  return updated;
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["books", "files", "covers", "progress", "highlights", "bookmarks"],
    "readwrite"
  );
  await tx.objectStore("books").delete(bookId);
  await tx.objectStore("files").delete(bookId);
  await tx.objectStore("covers").delete(bookId);
  await tx.objectStore("progress").delete(bookId);
  for (const h of await tx.objectStore("highlights").index("by-book").getAllKeys(bookId)) {
    await tx.objectStore("highlights").delete(h);
  }
  for (const b of await tx.objectStore("bookmarks").index("by-book").getAllKeys(bookId)) {
    await tx.objectStore("bookmarks").delete(b);
  }
  await tx.done;
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
}

export async function addHighlight(highlight: Highlight): Promise<void> {
  const db = await getDB();
  await db.put("highlights", highlight);
}

export async function getHighlights(bookId: string): Promise<Highlight[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("highlights", "by-book", bookId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateHighlight(
  id: string,
  patch: Partial<Pick<Highlight, "note" | "color" | "importance">>
): Promise<Highlight | undefined> {
  const db = await getDB();
  const existing = await db.get("highlights", id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  await db.put("highlights", updated);
  return updated;
}

export async function deleteHighlight(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("highlights", id);
}

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const db = await getDB();
  await db.put("bookmarks", bookmark);
}

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("bookmarks", "by-book", bookId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("bookmarks", id);
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
