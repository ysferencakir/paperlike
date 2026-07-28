import type { ReadingStatDay } from "./types";

/** Consecutive days with reading time, counting back from the most recent day. */
export function computeStreak(days: ReadingStatDay[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].minutes > 0) streak++;
    else break;
  }
  return streak;
}
