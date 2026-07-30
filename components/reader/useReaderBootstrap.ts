import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  getBook,
  getBookFile,
  getBookmarks,
  getHighlights,
  getProgress,
} from "@/lib/storage";
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
      status: "missingFile";
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
}

const defaultDependencies: ReaderBootstrapDependencies = {
  getBook,
  getBookFile,
  getProgress,
  getHighlights,
  getBookmarks,
};

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
