import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBook: vi.fn(),
  parseEpubFile: vi.fn(),
  parsePdfFile: vi.fn(),
}));

vi.mock("./storage", () => ({ addBook: mocks.addBook }));
vi.mock("./epub-loader", () => ({ parseEpubFile: mocks.parseEpubFile }));
vi.mock("./pdf-loader", () => ({ parsePdfFile: mocks.parsePdfFile }));

import type { Translate } from "./i18n/useTranslation";
import { importBookFile } from "./import-book";

const translate = ((key: string) =>
  key === "importBook.unknownAuthor" ? "Unknown Author" : key) as Translate;

describe("IT-IMPORT-001 book import routing", () => {
  beforeEach(() => {
    mocks.addBook.mockReset();
    mocks.parseEpubFile.mockReset();
    mocks.parsePdfFile.mockReset();
  });

  it("imports EPUB metadata, file, and cover", async () => {
    const cover = new Blob(["cover"], { type: "image/jpeg" });
    mocks.parseEpubFile.mockResolvedValue({
      title: "EPUB Title",
      author: "EPUB Author",
      coverBlob: cover,
    });
    const file = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "epub"],
      "sample.epub",
      { type: "application/epub+zip" }
    );

    const book = await importBookFile(file, translate);

    expect(book).toMatchObject({
      title: "EPUB Title",
      author: "EPUB Author",
      format: "epub",
      fileSize: file.size,
    });
    expect(mocks.parseEpubFile).toHaveBeenCalledWith(file, translate);
    expect(mocks.addBook).toHaveBeenCalledWith(book, file, cover);
  });

  it("imports PDF with filename and translated author fallbacks", async () => {
    mocks.parsePdfFile.mockResolvedValue({ title: "", author: "" });
    const file = new File(["%PDF-1.7\n"], "fallback-title.pdf", {
      type: "application/pdf",
    });

    const book = await importBookFile(file, translate);

    expect(book).toMatchObject({
      title: "fallback-title",
      author: "Unknown Author",
      format: "pdf",
    });
    expect(mocks.parsePdfFile).toHaveBeenCalledWith(file, "fallback-title", translate);
    expect(mocks.addBook).toHaveBeenCalledWith(book, file, undefined);
  });

  it("rejects unsupported files before parsing or storage", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" });

    await expect(importBookFile(file, translate)).rejects.toThrow("importBook.unsupportedType");
    expect(mocks.parseEpubFile).not.toHaveBeenCalled();
    expect(mocks.parsePdfFile).not.toHaveBeenCalled();
    expect(mocks.addBook).not.toHaveBeenCalled();
  });

  it("does not persist a book when parsing fails", async () => {
    mocks.parseEpubFile.mockRejectedValue(new Error("Corrupt EPUB"));
    const file = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "broken"],
      "broken.epub",
      { type: "application/epub+zip" }
    );

    await expect(importBookFile(file, translate)).rejects.toThrow("Corrupt EPUB");
    expect(mocks.addBook).not.toHaveBeenCalled();
  });

  it("rejects disguised PDF content before parsing or storage", async () => {
    const file = new File(["not really a PDF"], "disguised.pdf", {
      type: "application/pdf",
    });

    await expect(importBookFile(file, translate)).rejects.toThrow(
      "importBook.invalidContent"
    );
    expect(mocks.parsePdfFile).not.toHaveBeenCalled();
    expect(mocks.addBook).not.toHaveBeenCalled();
  });
});
