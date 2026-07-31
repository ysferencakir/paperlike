import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSyncStatusStore } from "@/store/useSyncStatusStore";
import { SyncStatusCard } from "./SyncStatusCard";

describe("SYNC-STATUS-001 user-visible sync state", () => {
  beforeEach(() => {
    useSyncStatusStore.getState().reset();
  });
  afterEach(cleanup);

  it("shows pending retry count and a manual retry action", () => {
    useSyncStatusStore.getState().setStatus({
      uid: "alice",
      phase: "retrying",
      pendingCount: 3,
      nextAttemptAt: Date.now() + 2_000,
      lastErrorCode: "network",
    });

    render(<SyncStatusCard />);

    expect(
      screen.getByText("Bağlantı gelince değişiklikler yeniden denenecek.")
    ).toBeInTheDocument();
    expect(screen.getByText("3 değişiklik bekliyor.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Şimdi tekrar dene" })
    ).toBeEnabled();
  });

  it("distinguishes an access error that needs user attention", () => {
    useSyncStatusStore.getState().setStatus({
      uid: "alice",
      phase: "attention",
      pendingCount: 1,
      nextAttemptAt: null,
      lastErrorCode: "permission-denied",
    });

    render(<SyncStatusCard />);

    expect(
      screen.getByText("Bazı değişiklikler için müdahale gerekiyor.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Google/Firebase erişim iznini yenileyip tekrar dene.")
    ).toBeInTheDocument();
  });
});
