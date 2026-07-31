export interface ZipBudgetEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
}

interface ZipEntrySizeData {
  compressedSize?: unknown;
  uncompressedSize?: unknown;
}

export function readZipBudgetEntries(
  files: Record<string, { name: string; dir: boolean }>
): ZipBudgetEntry[] | null {
  const entries: ZipBudgetEntry[] = [];
  for (const entry of Object.values(files)) {
    if (entry.dir) continue;
    const data = (entry as unknown as { _data?: ZipEntrySizeData })._data;
    if (
      typeof data?.compressedSize !== "number" ||
      typeof data.uncompressedSize !== "number"
    ) {
      return null;
    }
    entries.push({
      name: entry.name,
      compressedSize: data.compressedSize,
      uncompressedSize: data.uncompressedSize,
    });
  }
  return entries;
}

export interface ZipResourceLimits {
  maxArchiveBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxManifestBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
}

export const BACKUP_RESOURCE_LIMITS: ZipResourceLimits = {
  maxArchiveBytes: 4 * 1024 * 1024 * 1024,
  maxEntries: 10_000,
  maxEntryBytes: 1024 * 1024 * 1024,
  maxManifestBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 8 * 1024 * 1024 * 1024,
  maxCompressionRatio: 500,
};

export function isWithinZipResourceBudget(
  archiveBytes: number,
  entries: readonly ZipBudgetEntry[],
  limits: ZipResourceLimits = BACKUP_RESOURCE_LIMITS
): boolean {
  if (
    !Number.isSafeInteger(archiveBytes) ||
    archiveBytes < 0 ||
    archiveBytes > limits.maxArchiveBytes ||
    entries.length > limits.maxEntries
  ) {
    return false;
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    const { compressedSize, uncompressedSize } = entry;
    if (
      !Number.isSafeInteger(compressedSize) ||
      !Number.isSafeInteger(uncompressedSize) ||
      compressedSize < 0 ||
      uncompressedSize < 0 ||
      uncompressedSize > limits.maxEntryBytes ||
      (entry.name === "manifest.json" && uncompressedSize > limits.maxManifestBytes)
    ) {
      return false;
    }

    totalUncompressed += uncompressedSize;
    if (
      !Number.isSafeInteger(totalUncompressed) ||
      totalUncompressed > limits.maxTotalUncompressedBytes
    ) {
      return false;
    }

    if (
      uncompressedSize > 0 &&
      (compressedSize === 0 || uncompressedSize / compressedSize > limits.maxCompressionRatio)
    ) {
      return false;
    }
  }
  return true;
}
