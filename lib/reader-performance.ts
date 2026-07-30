export const DEFAULT_EPUB_LOCATION_BREAK = 1600;
export const TARGET_MAX_EPUB_LOCATION_MARKERS = 4000;

/**
 * Keeps EPUB percentage calculation useful without creating an unbounded
 * location density for very large books. This is a compressed-file-size
 * heuristic; extracted text size can still vary between EPUBs.
 */
export function getEpubLocationBreak(fileSize: number): number {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return DEFAULT_EPUB_LOCATION_BREAK;
  }

  return Math.max(
    DEFAULT_EPUB_LOCATION_BREAK,
    Math.ceil(fileSize / TARGET_MAX_EPUB_LOCATION_MARKERS)
  );
}

/**
 * The intersection observer normally decides which continuous-PDF pages
 * should own expensive canvas/text layers. Keeping the current page and its
 * neighbours as a fallback prevents a blank frame before the first observer
 * notification or after a programmatic page jump.
 */
export function shouldRenderPdfPage(
  page: number,
  currentPage: number,
  observedPages: ReadonlySet<number>
): boolean {
  return observedPages.has(page) || Math.abs(page - currentPage) <= 1;
}
