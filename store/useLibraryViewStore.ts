import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LibraryViewMode = "grid" | "list" | "shelf";

interface LibraryViewState {
  viewMode: LibraryViewMode;
  setViewMode: (mode: LibraryViewMode) => void;
}

export const useLibraryViewStore = create<LibraryViewState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: "library-view",
    }
  )
);
