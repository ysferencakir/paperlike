export interface ReaderSurfaceHandle {
  next: () => void;
  prev: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  /** Navigate to a TOC entry — epub.js href. No-op for PDF. */
  goToHref: (href: string) => void;
  /** Navigate to a saved highlight/bookmark location (CFI or `page:<n>`). */
  goToLocation: (location: string) => void;
  /** Paint a persistent highlight at a location. No-op for PDF (no stable overlay target). */
  applyHighlight: (location: string, color: string) => void;
  removeHighlight: (location: string) => void;
  /** Full-text search across the whole book. Capped, cancellable, and progressive. */
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  /** Plain text of the currently visible page/section, for text-to-speech. */
  getCurrentText: () => Promise<string>;
}

export interface SearchProgress {
  completed: number;
  total: number;
  resultCount: number;
}

export interface SearchOptions {
  signal?: AbortSignal;
  onProgress?: (progress: SearchProgress) => void;
}

export interface SelectionPayload {
  text: string;
  location: string;
}

export interface SearchResult {
  /** epub.js CFI, or `page:<n>` for PDF */
  location: string;
  excerpt: string;
}

export interface ReaderProgressInfo {
  /** Chapter/section label, empty if unknown */
  label: string;
  /** 0-100 */
  percentage: number;
  /** epub.js CFI, or `page:<n>` for PDF — persisted as ReadingProgress.location */
  location: string;
  page?: number;
  totalPages?: number;
}

export interface TocEntry {
  href: string;
  label: string;
  subitems?: TocEntry[];
}
