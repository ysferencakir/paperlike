import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "tr" | "en";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "tr",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "locale" }
  )
);
