import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Book, Bookmark, Highlight, ReadingProgress } from "@/lib/types";
import {
  useReaderBootstrap,
  type ReaderBootstrapDependencies,
} from "./useReaderBootstrap";

const BOOK: Book = {
  id: "book-1",
  title: "Test Book",
  author: "Test Author",
  format: "epub",
  addedAt: 1,
  fileSize: 128,
};

const FILE = new Blob(["book"], { type: "application/epub+zip" });

const PROGRESS: ReadingProgress = {
  bookId: BOOK.id,
  location: "epubcfi(/6/2)",
  percentage: 25,
  updatedAt: 2,
};

const HIGHLIGHTS: Highlight[] = [
  {
    id: "highlight-1",
    bookId: BOOK.id,
    location: "epubcfi(/6/2)",
    text: "Important sentence",
    color: "#fde68a",
    importance: 1,
    createdAt: 3,
  },
];

const BOOKMARKS: Bookmark[] = [
  {
    id: "bookmark-1",
    bookId: BOOK.id,
    location: "epubcfi(/6/2)",
    label: "Chapter 1",
    createdAt: 4,
  },
];

function dependencies(
  overrides: Partial<ReaderBootstrapDependencies> = {}
): ReaderBootstrapDependencies {
  return {
    getBook: vi.fn().mockResolvedValue(BOOK),
    getBookFile: vi.fn().mockResolvedValue(FILE),
    getProgress: vi.fn().mockResolvedValue(PROGRESS),
    getHighlights: vi.fn().mockResolvedValue(HIGHLIGHTS),
    getBookmarks: vi.fn().mockResolvedValue(BOOKMARKS),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("IT-READER-LOAD-001 useReaderBootstrap", () => {
  it("keeps loading visible until the bootstrap completes", async () => {
    const pendingBook = deferred<Book | undefined>();
    const deps = dependencies({ getBook: vi.fn(() => pendingBook.promise) });
    const { result } = renderHook(() => useReaderBootstrap(BOOK.id, deps));

    expect(result.current.bootstrap.status).toBe("loading");

    await act(async () => pendingBook.resolve(BOOK));
    await waitFor(() => expect(result.current.bootstrap.status).toBe("ready"));
  });

  it("returns ready with the complete reader payload", async () => {
    const { result } = renderHook(() => useReaderBootstrap(BOOK.id, dependencies()));

    await waitFor(() => expect(result.current.bootstrap.status).toBe("ready"));

    expect(result.current.bootstrap).toMatchObject({
      status: "ready",
      book: BOOK,
      file: FILE,
      initialLocation: PROGRESS.location,
    });
    expect(result.current.highlights).toEqual(HIGHLIGHTS);
    expect(result.current.bookmarks).toEqual(BOOKMARKS);
  });

  it("returns notFound when the book metadata does not exist", async () => {
    const deps = dependencies({ getBook: vi.fn().mockResolvedValue(undefined) });
    const { result } = renderHook(() => useReaderBootstrap(BOOK.id, deps));

    await waitFor(() => expect(result.current.bootstrap.status).toBe("notFound"));
    expect(result.current.bootstrap.book).toBeNull();
  });

  it("returns missingFile when metadata exists without a Blob", async () => {
    const deps = dependencies({ getBookFile: vi.fn().mockResolvedValue(undefined) });
    const { result } = renderHook(() => useReaderBootstrap(BOOK.id, deps));

    await waitFor(() => expect(result.current.bootstrap.status).toBe("missingFile"));
    expect(result.current.bootstrap.book).toEqual(BOOK);
    expect(result.current.bootstrap.file).toBeNull();
  });

  it("returns loadError when any storage request rejects", async () => {
    const deps = dependencies({
      getProgress: vi.fn().mockRejectedValue(new Error("IndexedDB unavailable")),
    });
    const { result } = renderHook(() => useReaderBootstrap(BOOK.id, deps));

    await waitFor(() => expect(result.current.bootstrap.status).toBe("loadError"));
    expect(result.current.highlights).toEqual([]);
    expect(result.current.bookmarks).toEqual([]);
  });

  it("ignores a stale request that resolves after the book changes", async () => {
    const staleBook = deferred<Book | undefined>();
    const secondBook = { ...BOOK, id: "book-2", title: "Second Book" };
    const deps = dependencies({
      getBook: vi.fn((bookId: string) =>
        bookId === BOOK.id ? staleBook.promise : Promise.resolve(secondBook)
      ),
    });
    const { result, rerender } = renderHook(
      ({ bookId }) => useReaderBootstrap(bookId, deps),
      { initialProps: { bookId: BOOK.id } }
    );

    rerender({ bookId: secondBook.id });
    await waitFor(() => expect(result.current.bootstrap.status).toBe("ready"));
    expect(result.current.bootstrap.book).toEqual(secondBook);

    staleBook.resolve(BOOK);
    await staleBook.promise;
    await Promise.resolve();

    expect(result.current.bootstrap.bookId).toBe(secondBook.id);
    expect(result.current.bootstrap.book).toEqual(secondBook);
  });
});
