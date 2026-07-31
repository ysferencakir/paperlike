export type BookFormat = "epub" | "pdf";

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  addedAt: number;
  fileSize: number;
  /** Freeform shelf category, e.g. "Roman", "Bilim Kurgu". Unset = uncategorized. */
  category?: string;
  /** Last local metadata write, used to resolve last-write-wins conflicts when pulling from Firestore. */
  updatedAt?: number;
  /** This book's file id in the user's Google Drive "Paperlike" folder, once uploaded. See lib/drive-sync.ts. */
  driveFileId?: string;
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

// Maps each level to its i18n key (not the label itself — see lib/i18n).
export const PAGE_TURN_ANIMATION_KEYS: Record<PageTurnAnimationLevel, "pageTurnAnimation.off" | "pageTurnAnimation.soft" | "pageTurnAnimation.realistic"> = {
  0: "pageTurnAnimation.off",
  1: "pageTurnAnimation.soft",
  2: "pageTurnAnimation.realistic",
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
  /** While true, columns auto-switches to 2 on tablet-width screens instead
   *  of following the stored `columns` value — turned off (sticking to
   *  `columns` everywhere) the moment the user manually taps the toggle. */
  columnsAutoManaged: boolean;
  /** Continuous vertical scroll instead of page-by-page. */
  scrollMode: boolean;
  /** Turn pages with the hardware volume buttons instead of changing media volume. */
  volumeKeyPageTurn: boolean;
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
  columnsAutoManaged: true,
  scrollMode: false,
  volumeKeyPageTurn: false,
  pageTurnAnimation: 1,
  autoNightMode: false,
  customBg: "#f7f1e3",
  customFg: "#3a3226",
};

export const HIGHLIGHT_COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** 0 = no special importance, 1-3 = star rating ("Önemli" .. "Çok Önemli"). */
export type ImportanceLevel = 0 | 1 | 2 | 3;

// Maps each level to its i18n key (not the label itself — see lib/i18n).
export const IMPORTANCE_KEYS: Record<ImportanceLevel, "importance.normal" | "importance.important" | "importance.veryImportant" | "importance.critical"> = {
  0: "importance.normal",
  1: "importance.important",
  2: "importance.veryImportant",
  3: "importance.critical",
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
  /** Last local write, used to resolve last-write-wins conflicts when pulling from Firestore. */
  updatedAt?: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  /** epub.js CFI string, or `page:<n>` for PDF */
  location: string;
  /** Chapter label or "Sayfa N", snapshotted at creation time. */
  label: string;
  createdAt: number;
  /** Last local write, used to keep an older delete tombstone from hiding a newer bookmark. */
  updatedAt?: number;
}

export type SyncTombstoneEntity = "book" | "highlight" | "bookmark";

/**
 * A durable, account-scoped deletion marker. It remains after the local
 * record is removed so an offline deletion cannot be resurrected by another
 * device's older snapshot on the next sync.
 */
export interface SyncTombstone {
  id: string;
  uid: string;
  entity: SyncTombstoneEntity;
  bookId: string;
  itemId?: string;
  /** Retained on a book tombstone until Drive cleanup can be retried. */
  driveFileId?: string;
  deletedAt: number;
}

/** One day's reading time, local calendar date (YYYY-MM-DD). */
export interface ReadingStatDay {
  date: string;
  minutes: number;
}

/**
 * A Google Drive resumable-upload session that's still in flight (or was
 * interrupted), persisted so an app restart/kill can pick the upload back up
 * instead of restarting the book file transfer from byte 0. See
 * lib/drive-sync.ts.
 */
export interface DriveUploadSession {
  bookId: string;
  /** The `Location` URI Drive returned when the resumable session was initiated. */
  sessionUri: string;
  filename: string;
  /** Total blob size in bytes — used both to build Content-Range headers and to detect a stale session (file changed size since). */
  totalBytes: number;
  createdAt: number;
}
