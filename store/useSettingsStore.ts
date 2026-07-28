import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_READER_SETTINGS, type ReaderSettings } from "@/lib/types";

interface SettingsState extends ReaderSettings {
  update: (patch: Partial<ReaderSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_READER_SETTINGS,
      update: (patch) => set((state) => ({ ...state, ...patch })),
      reset: () => set({ ...DEFAULT_READER_SETTINGS }),
    }),
    {
      name: "reader-settings",
    }
  )
);
