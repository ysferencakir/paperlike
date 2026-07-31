import { afterEach, describe, expect, it } from "vitest";
import {
  clearSyncStateForUid,
  completeSyncOutboxOperation,
  failSyncOutboxOperation,
  getSyncOutboxOperations,
  upsertSyncOutboxOperation,
} from "./storage";
import {
  classifySyncError,
  createSyncOutboxOperation,
  syncOutboxOperationId,
  syncRetryDelayMs,
} from "./sync-outbox";

const testUids = new Set<string>();

afterEach(async () => {
  await Promise.all([...testUids].map(clearSyncStateForUid));
  testUids.clear();
});

describe("SYNC-OUTBOX-001 durable mutation retry", () => {
  it("creates deterministic account-scoped operation ids", () => {
    expect(syncOutboxOperationId("alice", "highlight", "book/1", "note/1")).toBe(
      "alice:highlight:book%2F1:note%2F1"
    );
    expect(syncOutboxOperationId("bob", "highlight", "book/1", "note/1")).not.toBe(
      syncOutboxOperationId("alice", "highlight", "book/1", "note/1")
    );
  });

  it("applies bounded exponential backoff with deterministic jitter", () => {
    expect(syncRetryDelayMs(1, 0)).toBe(1_500);
    expect(syncRetryDelayMs(2, 0.5)).toBe(4_000);
    expect(syncRetryDelayMs(30, 1)).toBe(300_000);
  });

  it("persists only coarse error codes instead of remote messages", () => {
    expect(
      classifySyncError({
        code: "firestore/unavailable",
        message: "private path and token must not be persisted",
      })
    ).toBe("network");
    expect(classifySyncError({ code: "permission-denied" })).toBe(
      "permission-denied"
    );
  });

  it("retains a newer coalesced mutation when an older in-flight attempt completes", async () => {
    const uid = `outbox-${crypto.randomUUID()}`;
    testUids.add(uid);
    const older = createSyncOutboxOperation(uid, "book", {
      bookId: "book-1",
      now: 100,
    });
    await upsertSyncOutboxOperation(older);
    await failSyncOutboxOperation(older, "network", 2_000);

    expect(await getSyncOutboxOperations(uid)).toEqual([
      expect.objectContaining({
        attempts: 1,
        lastErrorCode: "network",
        nextAttemptAt: 2_000,
      }),
    ]);

    const newer = createSyncOutboxOperation(uid, "book", {
      bookId: "book-1",
      now: 3_000,
    });
    await upsertSyncOutboxOperation(newer);
    await completeSyncOutboxOperation(older.id, older.updatedAt);

    const remaining = await getSyncOutboxOperations(uid);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      id: older.id,
      attempts: 0,
      nextAttemptAt: 3_000,
    });

    await completeSyncOutboxOperation(
      remaining[0].id,
      remaining[0].updatedAt
    );
    expect(await getSyncOutboxOperations(uid)).toEqual([]);
  });
});
