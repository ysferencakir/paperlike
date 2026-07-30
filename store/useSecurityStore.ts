import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SecurityState {
  biometricLockEnabled: boolean;
  setBiometricLockEnabled: (enabled: boolean) => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set) => ({
      biometricLockEnabled: false,
      setBiometricLockEnabled: (enabled) => set({ biometricLockEnabled: enabled }),
    }),
    { name: "security" }
  )
);
