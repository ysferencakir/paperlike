import type { Translate } from "./i18n/useTranslation";

export interface ParsedEpub {
  title: string;
  author: string;
  coverBlob?: Blob;
}

export async function parseEpubFile(file: Blob, t: Translate): Promise<ParsedEpub> {
  // Loaded on demand — this runs from the library screen's "add book" flow,
  // and epubjs (plus the jszip it bundles internally) is otherwise only
  // needed once a book is actually opened in the reader.
  const { default: ePub } = await import("epubjs");
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  await book.ready;
  // book.ready resolves before epub.js finishes its internal resource-URL
  // replacement chain (resources.replacements() -> resources.replaceCss()).
  // book.opened waits for that chain too, so destroying the book before it
  // settles doesn't crash with "this.resources is undefined".
  await book.opened;

  const metadata = await book.loaded.metadata;
  const title = metadata.title?.trim() || t("epubLoader.untitledBook");
  const author = metadata.creator?.trim() || t("epubLoader.unknownAuthor");

  let coverBlob: Blob | undefined;
  try {
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      const res = await fetch(coverUrl);
      coverBlob = await res.blob();
      URL.revokeObjectURL(coverUrl);
    }
  } catch {
    coverBlob = undefined;
  }

  book.destroy();
  return { title, author, coverBlob };
}
