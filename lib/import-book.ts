import { addBook } from "./storage";
import type { Book, BookFormat } from "./types";
import { parseEpubFile } from "./epub-loader";
import { parsePdfFile } from "./pdf-loader";
import { generateId } from "./utils";

function detectFormat(file: File): BookFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".epub") || file.type === "application/epub+zip") {
    return "epub";
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return "pdf";
  }
  return null;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

export async function importBookFile(file: File): Promise<Book> {
  const format = detectFormat(file);
  if (!format) {
    throw new Error(`Desteklenmeyen dosya türü: ${file.name}`);
  }

  const fallbackTitle = stripExtension(file.name);
  const parsed =
    format === "epub"
      ? await parseEpubFile(file)
      : await parsePdfFile(file, fallbackTitle);

  const book: Book = {
    id: generateId(),
    title: parsed.title || fallbackTitle,
    author: parsed.author || "Bilinmeyen Yazar",
    format,
    addedAt: Date.now(),
    fileSize: file.size,
  };

  await addBook(book, file, parsed.coverBlob);
  return book;
}
