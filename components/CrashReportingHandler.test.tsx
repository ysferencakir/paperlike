import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrashReportingHandler } from "./CrashReportingHandler";
import { usePrivacyStore } from "@/store/usePrivacyStore";

const nativeMocks = vi.hoisted(() => ({
  recordException: vi.fn(async () => undefined),
  setCollectionEnabled: vi.fn(async () => undefined),
}));

vi.mock("@/lib/native-ui", () => ({
  recordException: nativeMocks.recordException,
  setCrashReportingCollectionEnabled: nativeMocks.setCollectionEnabled,
}));

describe("SEC-LOG-CONSENT-001 CrashReportingHandler", () => {
  beforeEach(() => {
    nativeMocks.recordException.mockClear();
    nativeMocks.setCollectionEnabled.mockClear();
    usePrivacyStore.setState({ crashReportingEnabled: false });
  });

  it("applies the default-off preference and does not forward errors", async () => {
    render(<CrashReportingHandler />);
    await waitFor(() => expect(nativeMocks.setCollectionEnabled).toHaveBeenCalledWith(false));

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("private title") }));
    expect(nativeMocks.recordException).not.toHaveBeenCalled();
  });

  it("forwards runtime errors only after explicit opt-in", async () => {
    render(<CrashReportingHandler />);
    act(() => {
      usePrivacyStore.setState({ crashReportingEnabled: true });
    });

    const error = new Error("redacted downstream");
    window.dispatchEvent(new ErrorEvent("error", { error }));
    await waitFor(() => expect(nativeMocks.recordException).toHaveBeenCalledWith(error));
  });
});
