export type PwaLifecycleStatus =
  | "idle"
  | "checking"
  | "installing"
  | "ready"
  | "activating"
  | "error";

export type PwaLifecycleError =
  | "registration"
  | "install"
  | "cache";

export interface PwaLifecycleState {
  status: PwaLifecycleStatus;
  error: PwaLifecycleError | null;
}

export type PwaLifecycleEvent =
  | { type: "CHECK_STARTED" }
  | { type: "CHECK_FINISHED" }
  | { type: "UPDATE_FOUND" }
  | { type: "UPDATE_READY" }
  | { type: "UPDATE_APPLYING" }
  | { type: "CONTROLLER_CHANGED" }
  | { type: "REGISTRATION_FAILED" }
  | { type: "INSTALL_FAILED" }
  | { type: "CACHE_FAILED" }
  | { type: "DISMISS_ERROR" };

export const initialPwaLifecycleState: PwaLifecycleState = {
  status: "idle",
  error: null,
};

export function reducePwaLifecycle(
  state: PwaLifecycleState,
  event: PwaLifecycleEvent
): PwaLifecycleState {
  switch (event.type) {
    case "CHECK_STARTED":
      return { status: "checking", error: null };
    case "CHECK_FINISHED":
      return state.status === "checking" ? initialPwaLifecycleState : state;
    case "UPDATE_FOUND":
      return { status: "installing", error: null };
    case "UPDATE_READY":
      return { status: "ready", error: null };
    case "UPDATE_APPLYING":
      return state.status === "ready"
        ? { status: "activating", error: null }
        : state;
    case "CONTROLLER_CHANGED":
    case "DISMISS_ERROR":
      return initialPwaLifecycleState;
    case "REGISTRATION_FAILED":
      return { status: "error", error: "registration" };
    case "INSTALL_FAILED":
      return { status: "error", error: "install" };
    case "CACHE_FAILED":
      return { status: "error", error: "cache" };
  }
}
