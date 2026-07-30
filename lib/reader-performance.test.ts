import { describe, expect, it } from "vitest";
import {
  DEFAULT_EPUB_LOCATION_BREAK,
  TARGET_MAX_EPUB_LOCATION_MARKERS,
  getEpubLocationBreak,
  shouldRenderPdfPage,
} from "./reader-performance";

describe("large-book performance policies", () => {
  it("keeps normal EPUB books at the default location density", () => {
    expect(getEpubLocationBreak(2_000_000)).toBe(DEFAULT_EPUB_LOCATION_BREAK);
  });

  it("caps the estimated location count for very large EPUB books", () => {
    const fileSize = 120_000_000;
    const locationBreak = getEpubLocationBreak(fileSize);

    expect(locationBreak).toBeGreaterThan(DEFAULT_EPUB_LOCATION_BREAK);
    expect(Math.ceil(fileSize / locationBreak)).toBeLessThanOrEqual(
      TARGET_MAX_EPUB_LOCATION_MARKERS
    );
  });

  it("renders only observed PDF pages plus the current-page safety window", () => {
    const observed = new Set([40, 41, 42]);

    expect(shouldRenderPdfPage(40, 41, observed)).toBe(true);
    expect(shouldRenderPdfPage(39, 40, new Set())).toBe(true);
    expect(shouldRenderPdfPage(400, 41, observed)).toBe(false);
  });
});
