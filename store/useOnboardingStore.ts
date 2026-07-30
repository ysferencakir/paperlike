import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  seenReaderTutorial: boolean;
  markReaderTutorialSeen: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      seenReaderTutorial: false,
      markReaderTutorialSeen: () => set({ seenReaderTutorial: true }),
    }),
    { name: "onboarding" }
  )
);
