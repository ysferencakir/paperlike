import type { Translate } from "./i18n/useTranslation";
import {
  isWithinZipResourceBudget,
  readZipBudgetEntries,
  type ZipResourceLimits,
} from "./zip-budget";

export interface ParsedEpub {
  title: string;
  author: string;
  coverBlob?: Blob;
}

const EPUB_RESOURCE_LIMITS: ZipResourceLimits = {
  maxArchiveBytes: 1024 * 1024 * 1024,
  maxEntries: 10_000,
  maxEntryBytes: 512 * 1024 * 1024,
  // EPUB has no Paperlike manifest.json; keep the generic validator's
  // special-case ceiling aligned with a normal XML package document.
  maxManifestBytes: 16 * 1024 * 1024,
  maxTotalUncompressedBytes: 4 * 1024 * 1024 * 1024,
  maxCompressionRatio: 500,
};

async function validateEpubArchive(
  arrayBuffer: ArrayBuffer,
  t: Translate
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    throw new Error(t("importBook.invalidContent"));
  }

  const entries = readZipBudgetEntries(zip.files);
  if (
    !entries ||
    !isWithinZipResourceBudget(arrayBuffer.byteLength, entries, EPUB_RESOURCE_LIMITS)
  ) {
    throw new Error(t("importBook.invalidContent"));
  }

  const mimetype = zip.file("mimetype");
  if (!mimetype || (await mimetype.async("string")).trim() !== "application/epub+zip") {
    throw new Error(t("importBook.invalidContent"));
  }
}

export async function parseEpubFile(file: Blob, t: Translate): Promise<ParsedEpub> {
  // Loaded on demand — this runs from the library screen's "add book" flow,
  // and epubjs (plus the jszip it bundles internally) is otherwise only
  // needed once a book is actually opened in the reader.
  const arrayBuffer = await file.arrayBuffer();
  await validateEpubArchive(arrayBuffer, t);
  const { default: ePub } = await import("epubjs");
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
