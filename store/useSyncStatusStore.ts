import { create } from "zustand";

export type SyncStatusPhase =
  | "idle"
  | "syncing"
  | "retrying"
  | "attention";

interface SyncStatusState {
  uid: string | null;
  phase: SyncStatusPhase;
  pendingCount: number;
  nextAttemptAt: number | null;
  lastErrorCode: string | null;
  setStatus: (status: Omit<SyncStatusState, "setStatus" | "reset">) => void;
  reset: () => void;
}

const idleState = {
  uid: null,
  phase: "idle" as const,
  pendingCount: 0,
  nextAttemptAt: null,
  lastErrorCode: null,
};

export const useSyncStatusStore = create<SyncStatusState>()((set) => ({
  ...idleState,
  setStatus: (status) => set(status),
  reset: () => set(idleState),
}));
