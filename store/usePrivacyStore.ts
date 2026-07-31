import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrivacyState {
  /**
   * Explicit opt-in only. This preference stays local to the device and is
   * deliberately not part of Firestore settings sync.
   */
  crashReportingEnabled: boolean;
  setCrashReportingEnabled: (enabled: boolean) => void;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      crashReportingEnabled: false,
      setCrashReportingEnabled: (enabled) => set({ crashReportingEnabled: enabled }),
    }),
    {
      name: "privacy-settings",
    }
  )
);
