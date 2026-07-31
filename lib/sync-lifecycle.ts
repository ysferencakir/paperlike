const blockedUsers = new Set<string>();
const activeOperations = new Map<string, Set<Promise<unknown>>>();

/**
 * Runs a cloud-sync operation unless account deletion has blocked new work
 * for this user. Every accepted operation is tracked so deletion can drain
 * work that was already in flight before it starts removing remote data.
 */
export async function runTrackedSync<T>(
  uid: string,
  operation: () => Promise<T>
): Promise<T | undefined> {
  if (blockedUsers.has(uid)) return undefined;

  const promise = operation();
  const operations = activeOperations.get(uid) ?? new Set<Promise<unknown>>();
  operations.add(promise);
  activeOperations.set(uid, operations);

  try {
    return await promise;
  } finally {
    operations.delete(promise);
    if (operations.size === 0) activeOperations.delete(uid);
  }
}

/**
 * Prevents new work and waits for already-started sync operations to settle.
 * Rejections are intentionally consumed here; their original callers still
 * receive them, while account deletion is allowed to continue from a stable
 * no-writes-in-flight point.
 */
export async function pauseSyncForAccountDeletion(uid: string): Promise<void> {
  blockedUsers.add(uid);
  const operations = activeOperations.get(uid);
  if (operations?.size) await Promise.allSettled([...operations]);
}

/** Re-enables sync when a failed deletion leaves the account usable. */
export function resumeSyncAfterAccountDeletion(uid: string): void {
  blockedUsers.delete(uid);
}
