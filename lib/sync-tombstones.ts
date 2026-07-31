import type {
  SyncTombstone,
  SyncTombstoneEntity,
} from "./types";

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function syncTombstoneId(
  entity: SyncTombstoneEntity,
  bookId: string,
  itemId?: string
): string {
  return [entity, encodeSegment(bookId), itemId ? encodeSegment(itemId) : ""].join(":");
}

export function createSyncTombstone(
  uid: string,
  entity: SyncTombstoneEntity,
  bookId: string,
  itemId?: string,
  deletedAt = Date.now()
): SyncTombstone {
  return {
    id: syncTombstoneId(entity, bookId, itemId),
    uid,
    entity,
    bookId,
    ...(itemId ? { itemId } : {}),
    deletedAt,
  };
}

export function tombstoneCovers(
  tombstone: SyncTombstone | undefined,
  recordUpdatedAt: number
): boolean {
  return Boolean(tombstone && tombstone.deletedAt >= recordUpdatedAt);
}

export function newestTombstones(
  tombstones: SyncTombstone[]
): Map<string, SyncTombstone> {
  const newest = new Map<string, SyncTombstone>();
  for (const tombstone of tombstones) {
    const existing = newest.get(tombstone.id);
    if (!existing || existing.deletedAt < tombstone.deletedAt) {
      newest.set(tombstone.id, tombstone);
    }
  }
  return newest;
}
