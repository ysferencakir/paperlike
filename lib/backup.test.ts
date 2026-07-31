// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Translate } from "./i18n/useTranslation";
import type { Book, Bookmark, Highlight, ReadingProgress } from "./types";
import {
  exportLibrary,
  importLibrary,
  isBackupAbortError,
  type BackupProgress,
} from "./backup";
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
    expect(await getBook(id)).toMatchObject(book);
    expect(await (await getBookFile(id))?.text()).toBe("pdf");
    expect((await getBookCover(id))?.type).toBe("image/webp");
    expect(await getProgress(id)).toEqual(progress);
    expect(await getHighlights(id)).toContainEqual({ ...highlight, updatedAt: expect.any(Number) });
    expect(await getBookmarks(id)).toContainEqual({
      ...bookmark,
      updatedAt: expect.any(Number),
    });

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

  it("rejects a partial archive before restoring any book", async () => {
    const { default: JSZip } = await import("jszip");
    const ids = [`partial-${crypto.randomUUID()}`, `partial-${crypto.randomUUID()}`];
    const books: Book[] = ids.map((id, index) => ({
      id,
      title: `Partial ${index + 1}`,
      author: "Paperlike",
      format: "pdf",
      addedAt: Date.now() + index,
      fileSize: 4,
    }));

    try {
      for (const book of books) {
        await addBook(book, new Blob(["data"], { type: "application/pdf" }));
      }
      const completeArchive = await exportLibrary();
      const zip = await JSZip.loadAsync(await completeArchive.arrayBuffer());
      zip.remove(`files/${books[1].id}.pdf`);
      const partialArchive = await zip.generateAsync({ type: "blob" });
      for (const id of ids) await deleteBook(id);

      await expect(importLibrary(partialArchive, translate)).rejects.toThrow(
        "backupLib.invalidFile"
      );
      expect(await getBook(ids[0])).toBeUndefined();
      expect(await getBook(ids[1])).toBeUndefined();
    } finally {
      for (const id of ids) await deleteBook(id);
    }
  });

  it("rejects malformed metadata before restoring any book", async () => {
    const { default: JSZip } = await import("jszip");
    const id = `invalid-metadata-${crypto.randomUUID()}`;
    const book: Book = {
      id,
      title: "Invalid Metadata",
      author: "Paperlike",
      format: "pdf",
      addedAt: Date.now(),
      fileSize: 4,
    };

    try {
      await addBook(book, new Blob(["data"], { type: "application/pdf" }));
      const completeArchive = await exportLibrary();
      const zip = await JSZip.loadAsync(await completeArchive.arrayBuffer());
      const manifestEntry = zip.file("manifest.json");
      expect(manifestEntry).not.toBeNull();
      const manifest = JSON.parse(await manifestEntry!.async("string")) as {
        metadata: { progress: unknown[] };
      };
      manifest.metadata.progress = [
        { bookId: id, location: 42, percentage: "all", updatedAt: null },
      ];
      zip.file("manifest.json", JSON.stringify(manifest));
      const invalidArchive = await zip.generateAsync({ type: "blob" });
      await deleteBook(id);

      await expect(importLibrary(invalidArchive, translate)).rejects.toThrow(
        "backupLib.invalidFile"
      );
      expect(await getBook(id)).toBeUndefined();
    } finally {
      await deleteBook(id);
    }
  });

  it("rejects a manifest file size that differs from the ZIP entry before restore", async () => {
    const { default: JSZip } = await import("jszip");
    const id = `invalid-size-${crypto.randomUUID()}`;
    const book: Book = {
      id,
      title: "Invalid Size",
      author: "Paperlike",
      format: "pdf",
      addedAt: Date.now(),
      fileSize: 4,
    };

    try {
      await addBook(book, new Blob(["data"], { type: "application/pdf" }));
      const completeArchive = await exportLibrary();
      const zip = await JSZip.loadAsync(await completeArchive.arrayBuffer());
      const manifestEntry = zip.file("manifest.json");
      expect(manifestEntry).not.toBeNull();
      const manifest = JSON.parse(await manifestEntry!.async("string")) as {
        books: Array<{ id: string; fileSize: number }>;
      };
      const manifestBook = manifest.books.find((entry) => entry.id === id);
      expect(manifestBook).toBeDefined();
      manifestBook!.fileSize = 3;
      zip.file("manifest.json", JSON.stringify(manifest));
      const invalidArchive = await zip.generateAsync({ type: "blob" });
      await deleteBook(id);

      await expect(importLibrary(invalidArchive, translate)).rejects.toThrow(
        "backupLib.invalidFile"
      );
      expect(await getBook(id)).toBeUndefined();
    } finally {
      await deleteBook(id);
    }
  });
});

describe("IT-BACKUP-CONTROL-001 progress and cancellation", () => {
  it("cancels ZIP generation from the compression progress callback", async () => {
    const controller = new AbortController();

    await expect(
      exportLibrary({
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.stage === "compressing") controller.abort();
        },
      })
    ).rejects.toSatisfy(isBackupAbortError);
  });

  it("cancels after validation without mutating the library", async () => {
    const id = `cancel-restore-${crypto.randomUUID()}`;
    const book: Book = {
      id,
      title: "Cancelled Restore",
      author: "Paperlike",
      format: "epub",
      addedAt: Date.now(),
      fileSize: 4,
    };
    const controller = new AbortController();

    try {
      await addBook(
        book,
        new Blob(["epub"], { type: "application/epub+zip" })
      );
      const archive = await exportLibrary();
      await deleteBook(id);

      await expect(
        importLibrary(archive, translate, {
          signal: controller.signal,
          onProgress: (progress) => {
            if (progress.stage === "validating" && progress.completed === 1) {
              controller.abort();
            }
          },
        })
      ).rejects.toSatisfy(isBackupAbortError);
      expect(await getBook(id)).toBeUndefined();
    } finally {
      await deleteBook(id);
    }
  });
});

describe("IT-BACKUP-LARGE-001 bounded large-fixture flow", () => {
  it("reports ordered stages while round-tripping multiple binary books", async () => {
    const ids = Array.from({ length: 6 }, () => `large-${crypto.randomUUID()}`);
    const bytesPerBook = 512 * 1024;
    const exportProgress: BackupProgress[] = [];
    const importProgress: BackupProgress[] = [];

    try {
      for (let index = 0; index < ids.length; index++) {
        const bytes = new Uint8Array(bytesPerBook);
        bytes.fill(index + 1);
        await addBook(
          {
            id: ids[index],
            title: `Large Fixture ${index + 1}`,
            author: "Paperlike",
            format: index % 2 === 0 ? "pdf" : "epub",
            addedAt: Date.now() + index,
            fileSize: bytes.length,
          },
          new Blob([bytes], {
            type: index % 2 === 0 ? "application/pdf" : "application/epub+zip",
          })
        );
      }

      const archive = await exportLibrary({ onProgress: (p) => exportProgress.push(p) });
      for (const id of ids) await deleteBook(id);
      const result = await importLibrary(archive, translate, {
        onProgress: (p) => importProgress.push(p),
      });

      expect(result.bookCount).toBe(ids.length);
      expect(exportProgress.some((p) => p.stage === "collecting")).toBe(true);
      expect(exportProgress.at(-1)).toMatchObject({
        stage: "compressing",
        percentage: 100,
      });
      expect(importProgress.map((p) => p.stage)).toEqual(
        expect.arrayContaining(["validating", "restoring", "metadata"])
      );
      for (const id of ids) {
        expect((await getBookFile(id))?.size).toBe(bytesPerBook);
      }
    } finally {
      for (const id of ids) await deleteBook(id);
    }
  }, 20_000);
});
