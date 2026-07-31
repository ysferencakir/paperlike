// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  pauseSyncForAccountDeletion,
  resumeSyncAfterAccountDeletion,
  runTrackedSync,
} from "./sync-lifecycle";

describe("SEC-SYNC-PAUSE account deletion sync barrier", () => {
  it("drains accepted work and blocks later work until resumed", async () => {
    const uid = "sync-barrier-user";
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let laterRan = false;

    const active = runTrackedSync(uid, () => pending);
    const pause = pauseSyncForAccountDeletion(uid);
    const blocked = runTrackedSync(uid, async () => {
      laterRan = true;
    });

    await expect(blocked).resolves.toBeUndefined();
    expect(laterRan).toBe(false);

    finish();
    await expect(active).resolves.toBeUndefined();
    await expect(pause).resolves.toBeUndefined();

    resumeSyncAfterAccountDeletion(uid);
    await runTrackedSync(uid, async () => {
      laterRan = true;
    });
    expect(laterRan).toBe(true);
  });
});
