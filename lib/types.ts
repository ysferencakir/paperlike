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

export type ReaderTheme = "light" | "sepia" | "dark" | "oled-black";

export type FontFamilyOption = "serif" | "sans" | "dyslexic";

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
  pageTurnAnimation: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: "light",
  warmth: 0,
  brightness: 100,
  contrast: 100,
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.6,
  margin: 32,
  columns: 1,
  pageTurnAnimation: true,
};

/**
 * Defined now so the storage schema doesn't need a migration later,
 * but no CRUD or UI is implemented for this in the MVP.
 */
export interface Highlight {
  id: string;
  bookId: string;
  /** epub.js CFI range, or `page:<n>` for PDF */
  location: string;
  color: string;
  note?: string;
  createdAt: number;
}
