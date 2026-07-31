import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  getBook,
  getBookFile,
  getBookmarks,
  getHighlights,
  getProgress,
  saveBookCover,
  saveBookFile,
} from "@/lib/storage";
import { downloadBookFileFromDrive } from "@/lib/drive-sync";
import { invalidateCoverCache } from "@/lib/cover-cache";
import { parseEpubFile } from "@/lib/epub-loader";
import { parsePdfFile } from "@/lib/pdf-loader";
import { translate } from "@/lib/i18n/useTranslation";
import type { Book, Bookmark, Highlight, ReadingProgress } from "@/lib/types";

export type ReaderBootstrapState =
  | {
      status: "loading" | "notFound" | "loadError";
      bookId: string;
      book: null;
      file: null;
      initialLocation: undefined;
    }
  | {
      status: "missingFile" | "downloadingFile";
      bookId: string;
      book: Book;
      file: null;
      initialLocation: undefined;
    }
  | {
      status: "ready";
      bookId: string;
      book: Book;
      file: Blob;
      initialLocation: string | undefined;
    };

export interface ReaderBootstrapDependencies {
  getBook: (bookId: string) => Promise<Book | undefined>;
  getBookFile: (bookId: string) => Promise<Blob | undefined>;
  getProgress: (bookId: string) => Promise<ReadingProgress | undefined>;
  getHighlights: (bookId: string) => Promise<Highlight[]>;
  getBookmarks: (bookId: string) => Promise<Bookmark[]>;
  downloadBookFileFromDrive: (fileId: string) => Promise<Blob | null>;
  saveBookFile: (bookId: string, blob: Blob) => Promise<void>;
}

const defaultDependencies: ReaderBootstrapDependencies = {
  getBook,
  getBookFile,
  getProgress,
  getHighlights,
  getBookmarks,
  downloadBookFileFromDrive,
  saveBookFile,
};

/**
 * Best-effort: a book pulled from Firestore has no cover locally yet (covers
 * aren't synced, only extracted from the file itself at import time). Once
 * its file is lazily downloaded from Drive, re-run the same extraction so
 * the library grid stops showing the placeholder cover. Never blocks or
 * fails the reader open — a broken/unextractable cover just stays a
 * placeholder.
 */
async function regenerateCoverBestEffort(book: Book, blob: Blob): Promise<void> {
  try {
    const parsed =
      book.format === "epub"
        ? await parseEpubFile(blob, translate)
        : await parsePdfFile(blob, book.title, translate);
    if (!parsed.coverBlob) return;
    await saveBookCover(book.id, parsed.coverBlob);
    invalidateCoverCache(book.id);
  } catch {
    // Best-effort only — the reader itself doesn't depend on this.
  }
}

const loadingState = (bookId: string): ReaderBootstrapState => ({
  status: "loading",
  bookId,
  book: null,
  file: null,
  initialLocation: undefined,
});

export function useReaderBootstrap(
  bookId: string,
  dependencies: ReaderBootstrapDependencies = defaultDependencies
): {
  bootstrap: ReaderBootstrapState;
  highlights: Highlight[];
  setHighlights: Dispatch<SetStateAction<Highlight[]>>;
  bookmarks: Bookmark[];
  setBookmarks: Dispatch<SetStateAction<Bookmark[]>>;
} {
  const [bootstrap, setBootstrap] = useState<ReaderBootstrapState>(() => loadingState(bookId));
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [book, file, progress, loadedHighlights, loadedBookmarks] = await Promise.all([
          dependencies.getBook(bookId),
          dependencies.getBookFile(bookId),
          dependencies.getProgress(bookId),
          dependencies.getHighlights(bookId),
          dependencies.getBookmarks(bookId),
        ]);
        if (cancelled) return;

        if (!book) {
          setHighlights([]);
          setBookmarks([]);
          setBootstrap({
            status: "notFound",
            bookId,
            book: null,
            file: null,
            initialLocation: undefined,
          });
          return;
        }

        if (!file) {
          if (book.driveFileId) {
            setHighlights([]);
            setBookmarks([]);
            setBootstrap({
              status: "downloadingFile",
              bookId,
              book,
              file: null,
              initialLocation: undefined,
            });
            const downloaded = await dependencies
              .downloadBookFileFromDrive(book.driveFileId)
              .catch(() => null);
            if (cancelled) return;
            if (downloaded) {
              await dependencies.saveBookFile(bookId, downloaded);
              void regenerateCoverBestEffort(book, downloaded);
              setHighlights(loadedHighlights);
              setBookmarks(loadedBookmarks);
              setBootstrap({
                status: "ready",
                bookId,
                book,
                file: downloaded,
                initialLocation: progress?.location,
              });
              return;
            }
          }

          setHighlights([]);
          setBookmarks([]);
          setBootstrap({
            status: "missingFile",
            bookId,
            book,
            file: null,
            initialLocation: undefined,
          });
          return;
        }

        setHighlights(loadedHighlights);
        setBookmarks(loadedBookmarks);
        setBootstrap({
          status: "ready",
          bookId,
          book,
          file,
          initialLocation: progress?.location,
        });
      } catch {
        if (!cancelled) {
          setHighlights([]);
          setBookmarks([]);
          setBootstrap({
            status: "loadError",
            bookId,
            book: null,
            file: null,
            initialLocation: undefined,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, dependencies]);

  const isCurrentBook = bootstrap.bookId === bookId;

  return {
    bootstrap: isCurrentBook ? bootstrap : loadingState(bookId),
    highlights: isCurrentBook ? highlights : [],
    setHighlights,
    bookmarks: isCurrentBook ? bookmarks : [],
    setBookmarks,
  };
}
