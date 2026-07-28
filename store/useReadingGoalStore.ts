import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ReadingGoalState {
  /** Daily reading goal, in minutes. A gentle target, never a demand. */
  dailyGoalMinutes: number;
  /** Whether to ever suggest a break during a long reading sitting. */
  breakRemindersEnabled: boolean;
  /** How long a continuous sitting goes before a break is (once) suggested. */
  breakIntervalMinutes: number;
  setDailyGoalMinutes: (minutes: number) => void;
  setBreakRemindersEnabled: (enabled: boolean) => void;
}

export const useReadingGoalStore = create<ReadingGoalState>()(
  persist(
    (set) => ({
      dailyGoalMinutes: 15,
      breakRemindersEnabled: true,
      breakIntervalMinutes: 30,
      setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
      setBreakRemindersEnabled: (breakRemindersEnabled) => set({ breakRemindersEnabled }),
    }),
    {
      name: "reading-goal",
    }
  )
);
