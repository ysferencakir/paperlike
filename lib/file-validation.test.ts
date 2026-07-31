import { describe, expect, it } from "vitest";
import { MAX_BOOK_FILE_BYTES, validateBookFile } from "./file-validation";

describe("SEC-FILE-001 book file validation", () => {
  it("accepts PDF headers within the first 1024 bytes", async () => {
    const file = new Blob([new Uint8Array(12), "%PDF-1.7\n"]);
    await expect(validateBookFile(file, "pdf")).resolves.toBeNull();
  });

  it("accepts supported ZIP signatures for EPUB files", async () => {
    const file = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])]);
    await expect(validateBookFile(file, "epub")).resolves.toBeNull();
  });

  it("rejects empty, oversized, and disguised content before parsing", async () => {
    await expect(validateBookFile(new Blob(), "pdf")).resolves.toBe("empty");
    await expect(validateBookFile(new Blob(["not a PDF"]), "pdf")).resolves.toBe(
      "invalidSignature"
    );
    const oversized = { size: MAX_BOOK_FILE_BYTES + 1 } as Blob;
    await expect(validateBookFile(oversized, "epub")).resolves.toBe("tooLarge");
  });
});
