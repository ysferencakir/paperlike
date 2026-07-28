export type BookFormat = "epub" | "pdf";

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  addedAt: number;
  fileSize: number;
}

export interface BookFile {
  bookId: string;
  blob: Blob;
}

export interface BookCover {
  bookId: string;
  blob: Blob;
}

export interface ReadingProgress {
  bookId: string;
  /** epub.js CFI string, or PDF page number as string */
  location: string;
  percentage: number;
  updatedAt: number;
}

export type ReaderTheme = "light" | "cream" | "sepia" | "dark" | "coffee" | "oled-black" | "custom";

/** Literata/Lora/EB Garamond are real book-typesetting fonts, loaded from Google Fonts. */
export type FontFamilyOption = "literata" | "lora" | "garamond" | "sans" | "dyslexic";

/** 0 = off, 1 = soft tilt/slide, 2 = a fuller page-flip with a moving fold shadow. */
export type PageTurnAnimationLevel = 0 | 1 | 2;

export const PAGE_TURN_ANIMATION_LABELS: Record<PageTurnAnimationLevel, string> = {
  0: "Kapalı",
  1: "Yumuşak",
  2: "Gerçekçi",
};

export interface ReaderSettings {
  theme: ReaderTheme;
  /** 0-100, blends a warm sepia/hue-rotate filter over the page for evening reading */
  warmth: number;
  /** CSS filter brightness, 50-150 (%) */
  brightness: number;
  /** CSS filter contrast, 50-150 (%) */
  contrast: number;
  fontFamily: FontFamilyOption;
  /** px */
  fontSize: number;
  lineHeight: number;
  /** px, horizontal page margin */
  margin: number;
  columns: 1 | 2;
  pageTurnAnimation: PageTurnAnimationLevel;
  /** Overrides `theme` with dark/oled during local night hours. */
  autoNightMode: boolean;
  /** Colors used when theme === "custom". */
  customBg: string;
  customFg: string;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: "light",
  warmth: 0,
  brightness: 100,
  contrast: 100,
  fontFamily: "literata",
  fontSize: 18,
  lineHeight: 1.6,
  margin: 32,
  columns: 1,
  pageTurnAnimation: 1,
  autoNightMode: false,
  customBg: "#f7f1e3",
  customFg: "#3a3226",
};

export const HIGHLIGHT_COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** 0 = no special importance, 1-3 = star rating ("Önemli" .. "Çok Önemli"). */
export type ImportanceLevel = 0 | 1 | 2 | 3;

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  0: "Normal",
  1: "Önemli",
  2: "Çok Önemli",
  3: "Kritik",
};

export interface Highlight {
  id: string;
  bookId: string;
  /** epub.js CFI range, or `page:<n>` for PDF */
  location: string;
  /** The highlighted text, shown in the highlights list. */
  text: string;
  color: string;
  importance: ImportanceLevel;
  note?: string;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  /** epub.js CFI string, or `page:<n>` for PDF */
  location: string;
  /** Chapter label or "Sayfa N", snapshotted at creation time. */
  label: string;
  createdAt: number;
}

/** One day's reading time, local calendar date (YYYY-MM-DD). */
export interface ReadingStatDay {
  date: string;
  minutes: number;
}
