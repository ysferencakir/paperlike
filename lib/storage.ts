import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Book, BookCover, BookFile, ReadingProgress } from "./types";

const DB_NAME = "epub-reader";
const DB_VERSION = 1;

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
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("storage.ts can only be used in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<ReaderDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const books = db.createObjectStore("books", { keyPath: "id" });
        books.createIndex("by-addedAt", "addedAt");
        db.createObjectStore("files", { keyPath: "bookId" });
        db.createObjectStore("covers", { keyPath: "bookId" });
        db.createObjectStore("progress", { keyPath: "bookId" });
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

export async function deleteBook(bookId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["books", "files", "covers", "progress"],
    "readwrite"
  );
  await tx.objectStore("books").delete(bookId);
  await tx.objectStore("files").delete(bookId);
  await tx.objectStore("covers").delete(bookId);
  await tx.objectStore("progress").delete(bookId);
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
