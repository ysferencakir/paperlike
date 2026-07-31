import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrashReportingConsent } from "./CrashReportingConsent";
import { usePrivacyStore } from "@/store/usePrivacyStore";

const consentMocks = vi.hoisted(() => ({
  setCollectionEnabled: vi.fn(async () => undefined),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));

vi.mock("@/lib/native-ui", () => ({
  setCrashReportingCollectionEnabled: consentMocks.setCollectionEnabled,
}));

describe("SEC-LOG-CONSENT-002 crash-reporting preference UI", () => {
  beforeEach(() => {
    consentMocks.setCollectionEnabled.mockClear();
    usePrivacyStore.setState({ crashReportingEnabled: false });
  });

  it("starts disabled and enables collection only after an explicit user action", async () => {
    render(<CrashReportingConsent />);
    const toggle = await screen.findByRole("switch", {
      name: "Kilitlenme raporlarını paylaş",
    });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(usePrivacyStore.getState().crashReportingEnabled).toBe(true);
      expect(consentMocks.setCollectionEnabled).toHaveBeenCalledWith(true);
    });
  });
});
