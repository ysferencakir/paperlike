// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Book, Bookmark, Highlight, ReadingProgress } from "./types";
import {
  addBook,
  addBookmark,
  addHighlight,
  deleteBook,
  deleteBookmark,
  deleteHighlight,
  getAllBooks,
  getBook,
  getBookCover,
  getBookFile,
  getBookmarks,
  getHighlights,
  getProgress,
  saveBookFile,
  setProgress,
  updateBook,
  updateHighlight,
  upsertBookMetadata,
  upsertBookmarkLocal,
  upsertHighlightLocal,
  upsertProgressLocal,
} from "./storage";

describe("IT-STORAGE-001 IndexedDB reader data", () => {
  it("persists, updates, queries, and deletes a complete book record", async () => {
    const id = `storage-${crypto.randomUUID()}`;
    const book: Book = {
      id,
      title: "Storage Test",
      author: "Paperlike",
      format: "epub",
      addedAt: Date.now(),
      fileSize: 4,
    };
    const file = new Blob(["epub"], { type: "application/epub+zip" });
    const cover = new Blob(["cover"], { type: "image/png" });
    const progress: ReadingProgress = {
      bookId: id,
      location: "epubcfi(/6/2)",
      percentage: 42,
      updatedAt: Date.now(),
    };
    const highlight: Highlight = {
      id: `${id}-highlight`,
      bookId: id,
      location: "epubcfi(/6/2!/4/2)",
      text: "Persistent highlight",
      color: "#fde68a",
      importance: 1,
      createdAt: Date.now(),
    };
    const bookmark: Bookmark = {
      id: `${id}-bookmark`,
      bookId: id,
      location: "epubcfi(/6/4)",
      label: "Chapter 2",
      createdAt: Date.now(),
    };

    await addBook(book, file, cover);
    await setProgress(progress);
    await addHighlight(highlight);
    await addBookmark(bookmark);

    expect(await getBook(id)).toMatchObject(book);
    expect(await getAllBooks()).toContainEqual(await getBook(id));
    expect(await (await getBookFile(id))?.text()).toBe("epub");
    expect((await getBookCover(id))?.type).toBe("image/png");
    expect(await getProgress(id)).toEqual(progress);
    expect(await getHighlights(id)).toEqual([{ ...highlight, updatedAt: expect.any(Number) }]);
    expect(await getBookmarks(id)).toEqual([bookmark]);

    expect(await updateBook(id, { title: "Updated Storage Test" })).toMatchObject({
      id,
      title: "Updated Storage Test",
    });
    expect(await updateHighlight(highlight.id, { note: "Updated note", importance: 3 }))
      .toMatchObject({
        id: highlight.id,
        note: "Updated note",
        importance: 3,
      });

    await deleteHighlight(highlight.id);
    await deleteBookmark(bookmark.id);
    expect(await getHighlights(id)).toEqual([]);
    expect(await getBookmarks(id)).toEqual([]);

    await deleteBook(id);
    expect(await getBook(id)).toBeUndefined();
    expect(await getBookFile(id)).toBeUndefined();
    expect(await getBookCover(id)).toBeUndefined();
    expect(await getProgress(id)).toBeUndefined();
  });
});

describe("IT-STORAGE-002 pull-sync local-only writers", () => {
  it("upserts pulled book/progress/highlight/bookmark data without a cloud push side effect", async () => {
    const id = `pull-${crypto.randomUUID()}`;
    const book: Book = {
      id,
      title: "Pulled From Firestore",
      author: "Paperlike",
      format: "pdf",
      addedAt: Date.now(),
      fileSize: 10,
      updatedAt: Date.now(),
      driveFileId: "drive-file-id-123",
    };
    const progress: ReadingProgress = {
      bookId: id,
      location: "page:3",
      percentage: 12,
      updatedAt: Date.now(),
    };
    const highlight: Highlight = {
      id: `${id}-highlight`,
      bookId: id,
      location: "page:3",
      text: "Pulled highlight",
      color: "#bfdbfe",
      importance: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const bookmark: Bookmark = {
      id: `${id}-bookmark`,
      bookId: id,
      location: "page:5",
      label: "Page 5",
      createdAt: Date.now(),
    };

    await upsertBookMetadata(book);
    await upsertProgressLocal(progress);
    await upsertHighlightLocal(highlight);
    await upsertBookmarkLocal(bookmark);

    expect(await getBook(id)).toEqual(book);
    expect(await getBookFile(id)).toBeUndefined(); // metadata-only — file is fetched lazily on open
    expect(await getProgress(id)).toEqual(progress);
    expect(await getHighlights(id)).toEqual([highlight]);
    expect(await getBookmarks(id)).toEqual([bookmark]);

    await saveBookFile(id, new Blob(["late file"], { type: "application/pdf" }));
    expect(await (await getBookFile(id))?.text()).toBe("late file");

    await deleteBook(id);
  });
});
