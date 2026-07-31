export const STORAGE_SAFETY_RESERVE_BYTES = 25 * 1024 * 1024;
export const LOW_STORAGE_THRESHOLD_BYTES = 100 * 1024 * 1024;

export interface WebStorageSnapshot {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

function storageManager(): StorageManager | undefined {
  if (typeof navigator === "undefined" || !("storage" in navigator)) return undefined;
  return navigator.storage;
}

export async function getWebStorageSnapshot(): Promise<WebStorageSnapshot> {
  const storage = storageManager();
  if (!storage) {
    return { supported: false, persisted: null, usage: null, quota: null };
  }

  const estimate = await storage.estimate();
  let persisted: boolean | null = null;
  if (typeof storage.persisted === "function") {
    try {
      persisted = await storage.persisted();
    } catch {
      // Quota information is still useful when the persistence state is unavailable.
    }
  }

  return {
    supported: true,
    persisted,
    usage: estimate.usage ?? null,
    quota: estimate.quota ?? null,
  };
}

export async function requestPersistentWebStorage(): Promise<boolean | null> {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== "function") return null;
  return storage.persist();
}

export function getAvailableStorage(snapshot: WebStorageSnapshot): number | null {
  if (snapshot.usage === null || snapshot.quota === null) return null;
  return Math.max(0, snapshot.quota - snapshot.usage);
}

export function isStorageLow(snapshot: WebStorageSnapshot): boolean {
  const available = getAvailableStorage(snapshot);
  if (available === null || snapshot.quota === null) return false;
  return (
    available < LOW_STORAGE_THRESHOLD_BYTES ||
    available < snapshot.quota * 0.1
  );
}

export function canStoreFiles(
  files: Iterable<Pick<File, "size">>,
  snapshot: WebStorageSnapshot
): boolean {
  const available = getAvailableStorage(snapshot);
  if (available === null) return true;

  let totalBytes = 0;
  for (const file of files) totalBytes += file.size;

  const reserve = Math.max(STORAGE_SAFETY_RESERVE_BYTES, totalBytes * 0.2);
  return totalBytes + reserve <= available;
}

export function formatStorageBytes(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`;
}
