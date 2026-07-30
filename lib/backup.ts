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

export type BackupStage =
  | "collecting"
  | "compressing"
  | "validating"
  | "restoring"
  | "metadata";

export interface BackupProgress {
  stage: BackupStage;
  completed: number;
  total: number;
  percentage: number;
  currentBook?: string;
}

export interface BackupOptions {
  signal?: AbortSignal;
  onProgress?: (progress: BackupProgress) => void;
}

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

function createBackupAbortError(): DOMException {
  return new DOMException("Backup operation was cancelled", "AbortError");
}

export function isBackupAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createBackupAbortError();
}

function reportProgress(
  options: BackupOptions | undefined,
  stage: BackupStage,
  completed: number,
  total: number,
  currentBook?: string
): void {
  options?.onProgress?.({
    stage,
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 100,
    currentBook,
  });
  throwIfAborted(options?.signal);
}

/**
 * JSZip needs an ArrayBuffer in Node tests, but browsers can hand it the Blob
 * directly. Keeping the Blob intact avoids an eager full-size copy on the
 * browser main thread for every large EPUB/PDF.
 */
function zipBinaryInput(blob: Blob): Blob | Promise<ArrayBuffer> {
  return typeof FileReader === "undefined" ? blob.arrayBuffer() : blob;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isValidManifest(value: unknown): value is BackupManifest {
  if (!isRecord(value)) return false;
  if (
    !Number.isInteger(value.formatVersion) ||
    (value.formatVersion as number) < 1 ||
    !isFiniteNumber(value.createdAt) ||
    !Array.isArray(value.books)
  ) {
    return false;
  }
  if (!isRecord(value.coverTypes) || !isRecord(value.metadata)) return false;
  if (!Object.values(value.coverTypes).every((type) => typeof type === "string")) {
    return false;
  }
  const metadata = value.metadata;
  if (
    !Array.isArray(metadata.progress) ||
    !Array.isArray(metadata.highlights) ||
    !Array.isArray(metadata.bookmarks) ||
    !Array.isArray(metadata.readingStats)
  ) {
    return false;
  }

  const ids = new Set<string>();
  const booksValid = value.books.every((book) => {
    if (!isRecord(book)) return false;
    if (
      !isSafeId(book.id) ||
      ids.has(book.id) ||
      typeof book.title !== "string" ||
      typeof book.author !== "string" ||
      (book.format !== "epub" && book.format !== "pdf") ||
      !isFiniteNumber(book.addedAt) ||
      !isFiniteNumber(book.fileSize) ||
      book.fileSize < 0 ||
      (book.category !== undefined && typeof book.category !== "string")
    ) {
      return false;
    }
    ids.add(book.id);
    return true;
  });
  if (!booksValid) return false;

  const validBookReference = (record: Record<string, unknown>) =>
    isSafeId(record.bookId) && ids.has(record.bookId);

  return (
    metadata.progress.every(
      (entry) =>
        isRecord(entry) &&
        validBookReference(entry) &&
        typeof entry.location === "string" &&
        isFiniteNumber(entry.percentage) &&
        entry.percentage >= 0 &&
        entry.percentage <= 100 &&
        isFiniteNumber(entry.updatedAt)
    ) &&
    metadata.highlights.every(
      (entry) =>
        isRecord(entry) &&
        isSafeId(entry.id) &&
        validBookReference(entry) &&
        typeof entry.location === "string" &&
        typeof entry.text === "string" &&
        typeof entry.color === "string" &&
        Number.isInteger(entry.importance) &&
        (entry.importance as number) >= 0 &&
        (entry.importance as number) <= 3 &&
        (entry.note === undefined || typeof entry.note === "string") &&
        isFiniteNumber(entry.createdAt)
    ) &&
    metadata.bookmarks.every(
      (entry) =>
        isRecord(entry) &&
        isSafeId(entry.id) &&
        validBookReference(entry) &&
        typeof entry.location === "string" &&
        typeof entry.label === "string" &&
        isFiniteNumber(entry.createdAt)
    ) &&
    metadata.readingStats.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
        isFiniteNumber(entry.minutes) &&
        entry.minutes >= 0
    )
  );
}

/** Bundles the whole library — books, covers, highlights, bookmarks, progress, stats — into one .zip Blob. */
export async function exportLibrary(options?: BackupOptions): Promise<Blob> {
  // Loaded on demand rather than at module scope — jszip is a sizeable
  // dependency that only backup/restore actually needs, and this module is
  // reachable from the library screen's header menu on every cold start.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const books = await getAllBooks();
  const metadata = await getAllMetadataForBackup();
  const coverTypes: Record<string, string> = {};

  reportProgress(options, "collecting", 0, books.length);
  for (let index = 0; index < books.length; index++) {
    const book = books[index];
    throwIfAborted(options?.signal);
    const [file, cover] = await Promise.all([getBookFile(book.id), getBookCover(book.id)]);
    if (file) {
      // EPUB/PDF content is already compressed. STORE avoids expensive,
      // low-value recompression of the largest backup entries.
      zip.file(
        `files/${book.id}.${fileExtension(book.format)}`,
        zipBinaryInput(file),
        { compression: "STORE" }
      );
    }
    if (cover) {
      zip.file(`covers/${book.id}`, zipBinaryInput(cover), { compression: "STORE" });
      coverTypes[book.id] = cover.type || "image/jpeg";
    }
    reportProgress(options, "collecting", index + 1, books.length, book.title);
  }

  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: Date.now(),
    books,
    coverTypes,
    metadata,
  };
  zip.file(MANIFEST_NAME, JSON.stringify(manifest));

  throwIfAborted(options?.signal);
  let cancelledDuringGeneration = false;
  const archive = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      streamFiles: true,
    },
    (metadata) => {
      options?.onProgress?.({
        stage: "compressing",
        completed: metadata.percent,
        total: 100,
        percentage: Math.round(metadata.percent),
        currentBook: metadata.currentFile ?? undefined,
      });
      // JSZip does not expose a safe stream-abort API, and throwing from this
      // callback leaves generateAsync pending. Mark cancellation and reject
      // the completed artifact instead. Large EPUB/PDF entries use STORE, so
      // this does not continue an expensive recompression pass.
      if (options?.signal?.aborted) cancelledDuringGeneration = true;
    }
  );
  if (cancelledDuringGeneration || options?.signal?.aborted) {
    throw createBackupAbortError();
  }
  return archive;
}

/** Restores a .zip produced by exportLibrary(). Existing books with the same id are overwritten. */
export async function importLibrary(
  zipBlob: Blob,
  t: Translate,
  options?: BackupOptions
): Promise<{ bookCount: number }> {
  const { default: JSZip } = await import("jszip");
  reportProgress(options, "validating", 0, 1);
  const zip = await JSZip.loadAsync(zipBinaryInput(zipBlob), { checkCRC32: true });
  throwIfAborted(options?.signal);
  const manifestEntry = zip.file(MANIFEST_NAME);
  if (!manifestEntry) throw new Error(t("backupLib.invalidFile"));

  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(await manifestEntry.async("string"));
  } catch {
    throw new Error(t("backupLib.invalidFile"));
  }
  if (
    isRecord(parsedManifest) &&
    Number.isInteger(parsedManifest.formatVersion) &&
    (parsedManifest.formatVersion as number) > BACKUP_FORMAT_VERSION
  ) {
    throw new Error(t("backupLib.newerVersion"));
  }
  if (!isValidManifest(parsedManifest)) throw new Error(t("backupLib.invalidFile"));
  const manifest = parsedManifest;

  // Validate the full file map before the first IndexedDB mutation. A partial
  // or malformed archive must not leave half a restore in the library.
  for (const book of manifest.books) {
    if (!zip.file(`files/${book.id}.${fileExtension(book.format)}`)) {
      throw new Error(t("backupLib.invalidFile"));
    }
  }
  reportProgress(options, "validating", 1, 1);

  let restored = 0;
  reportProgress(options, "restoring", 0, manifest.books.length);
  for (let index = 0; index < manifest.books.length; index++) {
    const book = manifest.books[index];
    throwIfAborted(options?.signal);
    const fileEntry = zip.file(`files/${book.id}.${fileExtension(book.format)}`);
    // Preflight above guarantees this, and the guard keeps the type narrow.
    if (!fileEntry) throw new Error(t("backupLib.invalidFile"));
    const rawFileBlob = await fileEntry.async("blob");
    throwIfAborted(options?.signal);
    const fileBlob = new Blob([rawFileBlob], {
      type: book.format === "pdf" ? "application/pdf" : "application/epub+zip",
    });

    const coverEntry = zip.file(`covers/${book.id}`);
    const rawCoverBlob = coverEntry ? await coverEntry.async("blob") : undefined;
    throwIfAborted(options?.signal);
    const coverBlob = rawCoverBlob
      ? new Blob([rawCoverBlob], { type: manifest.coverTypes[book.id] ?? "image/jpeg" })
      : undefined;

    await addBook(book, fileBlob, coverBlob);
    restored += 1;
    reportProgress(options, "restoring", index + 1, manifest.books.length, book.title);
  }

  reportProgress(options, "metadata", 0, 1);
  await importMetadata(manifest.metadata);
  reportProgress(options, "metadata", 1, 1);
  return { bookCount: restored };
}
