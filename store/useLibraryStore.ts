import { create } from "zustand";
import type { Book } from "@/lib/types";
import { deleteBook, getAllBooks, updateBook } from "@/lib/storage";

interface LibraryState {
  books: Book[];
  loaded: boolean;
  refresh: () => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  renameBook: (
    bookId: string,
    patch: Partial<Pick<Book, "title" | "author" | "category">>
  ) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  books: [],
  loaded: false,
  refresh: async () => {
    const books = await getAllBooks();
    set({ books, loaded: true });
  },
  removeBook: async (bookId: string) => {
    await deleteBook(bookId);
    set((state) => ({ books: state.books.filter((b) => b.id !== bookId) }));
  },
  renameBook: async (bookId, patch) => {
    const updated = await updateBook(bookId, patch);
    if (!updated) return;
    set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  },
}));
