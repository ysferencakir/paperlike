import { describe, expect, it } from "vitest";
import {
  initialPwaLifecycleState,
  reducePwaLifecycle,
  type PwaLifecycleEvent,
} from "./pwa-lifecycle";

function transition(events: PwaLifecycleEvent[]) {
  return events.reduce(reducePwaLifecycle, initialPwaLifecycleState);
}

describe("PWA lifecycle state machine", () => {
  it("models a successful controlled update", () => {
    expect(
      transition([
        { type: "CHECK_STARTED" },
        { type: "UPDATE_FOUND" },
        { type: "UPDATE_READY" },
        { type: "UPDATE_APPLYING" },
      ])
    ).toEqual({ status: "activating", error: null });
  });

  it("keeps failures explicit and allows a clean retry", () => {
    const failed = transition([
      { type: "CHECK_STARTED" },
      { type: "UPDATE_FOUND" },
      { type: "INSTALL_FAILED" },
    ]);
    expect(failed).toEqual({ status: "error", error: "install" });
    expect(reducePwaLifecycle(failed, { type: "CHECK_STARTED" })).toEqual({
      status: "checking",
      error: null,
    });
  });

  it("reports runtime cache failures independently", () => {
    expect(reducePwaLifecycle(initialPwaLifecycleState, { type: "CACHE_FAILED" }))
      .toEqual({ status: "error", error: "cache" });
  });
});
