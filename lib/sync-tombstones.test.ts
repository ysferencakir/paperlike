import { describe, expect, it } from "vitest";
import {
  createSyncTombstone,
  newestTombstones,
  syncTombstoneId,
  tombstoneCovers,
} from "./sync-tombstones";

describe("SYNC-TOMBSTONE-001 deletion reconciliation", () => {
  it("builds deterministic Firestore-safe ids without mixing entity types", () => {
    expect(syncTombstoneId("book", "book/one")).toBe("book:book%2Fone:");
    expect(syncTombstoneId("highlight", "book/one", "note/one")).toBe(
      "highlight:book%2Fone:note%2Fone"
    );
    expect(syncTombstoneId("bookmark", "book/one", "note/one")).not.toBe(
      syncTombstoneId("highlight", "book/one", "note/one")
    );
  });

  it("keeps the newest account-scoped marker for repeated offline deletion", () => {
    const older = createSyncTombstone("alice", "book", "book-1", undefined, 10);
    const newer = createSyncTombstone("alice", "book", "book-1", undefined, 20);
    const merged = newestTombstones([newer, older]);

    expect(merged.get(older.id)).toEqual(newer);
    expect(merged.get(older.id)?.uid).toBe("alice");
  });

  it("prevents an older second-device snapshot from resurrecting a deletion", () => {
    const deletion = createSyncTombstone(
      "alice",
      "highlight",
      "book-1",
      "highlight-1",
      20
    );

    expect(tombstoneCovers(deletion, 10)).toBe(true);
    expect(tombstoneCovers(deletion, 20)).toBe(true);
    expect(tombstoneCovers(deletion, 21)).toBe(false);
  });
});
