import type { BookFormat } from "./types";

// This is a security ceiling, not a performance promise. The documented
// "large" performance class starts at 150 MiB and remains well below it.
export const MAX_BOOK_FILE_BYTES = 1024 * 1024 * 1024;

const PDF_HEADER_SCAN_BYTES = 1024;

export type BookFileValidationError = "empty" | "tooLarge" | "invalidSignature";

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function containsAscii(bytes: Uint8Array, text: string): boolean {
  const signature = new TextEncoder().encode(text);
  outer: for (let start = 0; start <= bytes.length - signature.length; start++) {
    for (let index = 0; index < signature.length; index++) {
      if (bytes[start + index] !== signature[index]) continue outer;
    }
    return true;
  }
  return false;
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

export async function validateBookFile(
  file: Blob,
  format: BookFormat
): Promise<BookFileValidationError | null> {
  if (file.size === 0) return "empty";
  if (file.size > MAX_BOOK_FILE_BYTES) return "tooLarge";

  const prefix = new Uint8Array(
    await file.slice(0, Math.min(file.size, PDF_HEADER_SCAN_BYTES)).arrayBuffer()
  );
  if (format === "pdf") {
    return containsAscii(prefix, "%PDF-") ? null : "invalidSignature";
  }
  return hasZipSignature(prefix) ? null : "invalidSignature";
}
