import {
  addBook,
  getAllBooks,
  getAllMetadataForBackup,
  getBookCover,
  getBookFile,
  importMetadata,
} from "./storage";
import type { Translate } from "./i18n/useTranslation";

const MANIFEST_NAME = "manifest.json";
const BACKUP_FORMAT_VERSION = 1;

interface BackupManifest {
  formatVersion: number;
  createdAt: number;
  books: Awaited<ReturnType<typeof getAllBooks>>;
  coverTypes: Record<string, string>;
  metadata: Awaited<ReturnType<typeof getAllMetadataForBackup>>;
}

function fileExtension(format: string): string {
  return format === "pdf" ? "pdf" : "epub";
}

/** Bundles the whole library — books, covers, highlights, bookmarks, progress, stats — into one .zip Blob. */
export async function exportLibrary(): Promise<Blob> {
  // Loaded on demand rather than at module scope — jszip is a sizeable
  // dependency that only backup/restore actually needs, and this module is
  // reachable from the library screen's header menu on every cold start.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const books = await getAllBooks();
  const metadata = await getAllMetadataForBackup();
  const coverTypes: Record<string, string> = {};

  for (const book of books) {
    const [file, cover] = await Promise.all([getBookFile(book.id), getBookCover(book.id)]);
    if (file) {
      zip.file(`files/${book.id}.${fileExtension(book.format)}`, await file.arrayBuffer());
    }
    if (cover) {
      zip.file(`covers/${book.id}`, await cover.arrayBuffer());
      coverTypes[book.id] = cover.type || "image/jpeg";
    }
  }

  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: Date.now(),
    books,
    coverTypes,
    metadata,
  };
  zip.file(MANIFEST_NAME, JSON.stringify(manifest));

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/** Restores a .zip produced by exportLibrary(). Existing books with the same id are overwritten. */
export async function importLibrary(zipBlob: Blob, t: Translate): Promise<{ bookCount: number }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  const manifestEntry = zip.file(MANIFEST_NAME);
  if (!manifestEntry) throw new Error(t("backupLib.invalidFile"));

  const manifest = JSON.parse(await manifestEntry.async("string")) as BackupManifest;
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(t("backupLib.newerVersion"));
  }

  for (const book of manifest.books) {
    const fileEntry = zip.file(`files/${book.id}.${fileExtension(book.format)}`);
    if (!fileEntry) continue; // book entry without its file is unrecoverable — skip it
    const fileBlob = await fileEntry.async("blob");

    const coverEntry = zip.file(`covers/${book.id}`);
    const coverBlob = coverEntry
      ? new Blob([await coverEntry.async("arraybuffer")], {
          type: manifest.coverTypes[book.id] ?? "image/jpeg",
        })
      : undefined;

    await addBook(book, fileBlob, coverBlob);
  }

  await importMetadata(manifest.metadata);
  return { bookCount: manifest.books.length };
}
