// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Translate } from "./i18n/useTranslation";
import type { Book, Bookmark, Highlight, ReadingProgress } from "./types";
import { exportLibrary, importLibrary } from "./backup";
import {
  addBook,
  addBookmark,
  addHighlight,
  deleteBook,
  getBook,
  getBookCover,
  getBookFile,
  getBookmarks,
  getHighlights,
  getProgress,
  setProgress,
} from "./storage";

const translate = ((key: string) => key) as Translate;

describe("IT-BACKUP-ROUNDTRIP-001 library backup", () => {
  it("exports and restores book files, covers, progress, highlights, and bookmarks", async () => {
    const id = `backup-${crypto.randomUUID()}`;
    const book: Book = {
      id,
      title: "Backup Test",
      author: "Paperlike",
      format: "pdf",
      addedAt: Date.now(),
      fileSize: 3,
    };
    const file = new Blob(["pdf"], { type: "application/pdf" });
    const cover = new Blob(["cover"], { type: "image/webp" });
    const progress: ReadingProgress = {
      bookId: id,
      location: "page:7",
      percentage: 35,
      updatedAt: Date.now(),
    };
    const highlight: Highlight = {
      id: `${id}-highlight`,
      bookId: id,
      location: "page:7",
      text: "Backup highlight",
      color: "#bfdbfe",
      importance: 2,
      note: "Keep this",
      createdAt: Date.now(),
    };
    const bookmark: Bookmark = {
      id: `${id}-bookmark`,
      bookId: id,
      location: "page:7",
      label: "Page 7",
      createdAt: Date.now(),
    };

    await addBook(book, file, cover);
    await setProgress(progress);
    await addHighlight(highlight);
    await addBookmark(bookmark);

    const archive = await exportLibrary();
    await deleteBook(id);
    expect(await getBook(id)).toBeUndefined();

    const result = await importLibrary(archive, translate);

    expect(result.bookCount).toBeGreaterThanOrEqual(1);
    expect(await getBook(id)).toEqual(book);
    expect(await (await getBookFile(id))?.text()).toBe("pdf");
    expect((await getBookCover(id))?.type).toBe("image/webp");
    expect(await getProgress(id)).toEqual(progress);
    expect(await getHighlights(id)).toContainEqual(highlight);
    expect(await getBookmarks(id)).toContainEqual(bookmark);

    await deleteBook(id);
  });
});

describe("IT-BACKUP-VALIDATION-001 invalid backup", () => {
  it("rejects a ZIP without a manifest", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("unrelated.txt", "not a Paperlike backup");
    const archive = await zip.generateAsync({ type: "blob" });

    await expect(importLibrary(archive, translate)).rejects.toThrow("backupLib.invalidFile");
  });
});
