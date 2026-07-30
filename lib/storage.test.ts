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
  setProgress,
  updateBook,
  updateHighlight,
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

    expect(await getBook(id)).toEqual(book);
    expect(await getAllBooks()).toContainEqual(book);
    expect(await (await getBookFile(id))?.text()).toBe("epub");
    expect((await getBookCover(id))?.type).toBe("image/png");
    expect(await getProgress(id)).toEqual(progress);
    expect(await getHighlights(id)).toEqual([highlight]);
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
