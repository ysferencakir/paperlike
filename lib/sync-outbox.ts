import type {
  SyncOutboxKind,
  SyncOutboxOperation,
} from "./types";

const BASE_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function syncOutboxOperationId(
  uid: string,
  kind: SyncOutboxKind,
  bookId?: string,
  itemId?: string
): string {
  return [
    encodeSegment(uid),
    kind,
    bookId ? encodeSegment(bookId) : "",
    itemId ? encodeSegment(itemId) : "",
  ].join(":");
}

export function createSyncOutboxOperation(
  uid: string,
  kind: SyncOutboxKind,
  options: {
    bookId?: string;
    itemId?: string;
    now?: number;
  } = {}
): SyncOutboxOperation {
  const now = options.now ?? Date.now();
  return {
    id: syncOutboxOperationId(uid, kind, options.bookId, options.itemId),
    uid,
    kind,
    ...(options.bookId ? { bookId: options.bookId } : {}),
    ...(options.itemId ? { itemId: options.itemId } : {}),
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    nextAttemptAt: now,
  };
}

export function syncRetryDelayMs(
  attempts: number,
  randomValue = Math.random()
): number {
  const exponent = Math.max(0, attempts - 1);
  const withoutJitter = Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** exponent
  );
  const boundedRandom = Math.min(1, Math.max(0, randomValue));
  const jitter = 0.75 + boundedRandom * 0.5;
  return Math.min(MAX_RETRY_DELAY_MS, Math.round(withoutJitter * jitter));
}

/** Stores only a coarse code; remote messages, paths and tokens never enter IndexedDB. */
export function classifySyncError(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const code =
    "code" in error && typeof error.code === "string"
      ? error.code.toLowerCase()
      : "";
  if (code.includes("permission") || code.includes("unauth")) {
    return "permission-denied";
  }
  if (code.includes("quota") || code.includes("resource-exhausted")) {
    return "quota-exceeded";
  }
  if (
    code.includes("network") ||
    code.includes("offline") ||
    code.includes("unavailable") ||
    code.includes("timeout")
  ) {
    return "network";
  }
  return "unknown";
}
