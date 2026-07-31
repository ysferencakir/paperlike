import { addBook } from "./storage";
import type { Book, BookFormat } from "./types";
import { parseEpubFile } from "./epub-loader";
import { parsePdfFile } from "./pdf-loader";
import { generateId } from "./utils";
import type { Translate } from "./i18n/useTranslation";
import { validateBookFile } from "./file-validation";

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

export async function importBookFile(file: File, t: Translate): Promise<Book> {
  const format = detectFormat(file);
  if (!format) {
    throw new Error(t("importBook.unsupportedType", { filename: file.name }));
  }
  const validationError = await validateBookFile(file, format);
  if (validationError === "tooLarge") {
    throw new Error(t("importBook.fileTooLarge"));
  }
  if (validationError) {
    throw new Error(t("importBook.invalidContent"));
  }

  const fallbackTitle = stripExtension(file.name);
  const parsed =
    format === "epub"
      ? await parseEpubFile(file, t)
      : await parsePdfFile(file, fallbackTitle, t);

  const book: Book = {
    id: generateId(),
    title: parsed.title || fallbackTitle,
    author: parsed.author || t("importBook.unknownAuthor"),
    format,
    addedAt: Date.now(),
    fileSize: file.size,
  };

  await addBook(book, file, parsed.coverBlob);
  return book;
}
