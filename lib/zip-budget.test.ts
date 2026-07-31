import { describe, expect, it } from "vitest";
import { isWithinZipResourceBudget, type ZipResourceLimits } from "./zip-budget";

const limits: ZipResourceLimits = {
  maxArchiveBytes: 1_000,
  maxEntries: 2,
  maxEntryBytes: 500,
  maxManifestBytes: 100,
  maxTotalUncompressedBytes: 600,
  maxCompressionRatio: 10,
};

describe("SEC-ZIP-001 backup ZIP resource budgets", () => {
  it("accepts an archive inside every resource budget", () => {
    expect(
      isWithinZipResourceBudget(
        300,
        [
          { name: "manifest.json", compressedSize: 20, uncompressedSize: 80 },
          { name: "files/book.pdf", compressedSize: 400, uncompressedSize: 400 },
        ],
        limits
      )
    ).toBe(true);
  });

  it.each([
    [
      "archive bytes",
      1_001,
      [{ name: "manifest.json", compressedSize: 10, uncompressedSize: 10 }],
    ],
    [
      "entry count",
      100,
      [
        { name: "a", compressedSize: 1, uncompressedSize: 1 },
        { name: "b", compressedSize: 1, uncompressedSize: 1 },
        { name: "c", compressedSize: 1, uncompressedSize: 1 },
      ],
    ],
    [
      "single entry bytes",
      100,
      [{ name: "files/book.pdf", compressedSize: 100, uncompressedSize: 501 }],
    ],
    [
      "manifest bytes",
      100,
      [{ name: "manifest.json", compressedSize: 50, uncompressedSize: 101 }],
    ],
    [
      "total expanded bytes",
      100,
      [
        { name: "a", compressedSize: 400, uncompressedSize: 400 },
        { name: "b", compressedSize: 201, uncompressedSize: 201 },
      ],
    ],
    [
      "compression ratio",
      100,
      [{ name: "files/book.pdf", compressedSize: 10, uncompressedSize: 101 }],
    ],
  ])("rejects a ZIP exceeding its %s budget", (_name, archiveBytes, entries) => {
    expect(isWithinZipResourceBudget(archiveBytes, entries, limits)).toBe(false);
  });
});
