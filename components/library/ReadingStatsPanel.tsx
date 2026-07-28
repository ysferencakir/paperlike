"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { getRecentReadingStats } from "@/lib/storage";
import { computeStreak } from "@/lib/reading-stats";
import type { ReadingStatDay } from "@/lib/types";
import { useReadingGoalStore } from "@/store/useReadingGoalStore";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function todayMinutes(days: ReadingStatDay[]): number {
  return days.at(-1)?.minutes ?? 0;
}

function todaySummary(minutes: number): string {
  if (minutes <= 0) {
    return "Bugün henüz okumaya başlamadın. İstediğin an, istediğin sayfadan devam edebilirsin.";
  }
  if (minutes < 60) return `Bugün ${Math.round(minutes)} dakika kitabının içindeydin ✨`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `Bugün ${hours} saat${rest > 0 ? ` ${rest} dakika` : ""} kitabının içindeydin ✨`;
}

export function ReadingStatsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [days, setDays] = useState<ReadingStatDay[] | null>(null);
  const { dailyGoalMinutes, setDailyGoalMinutes, breakRemindersEnabled, setBreakRemindersEnabled } =
    useReadingGoalStore();

  useEffect(() => {
    if (!open) return;
    void getRecentReadingStats(7).then(setDays);
  }, [open]);

  const streak = days ? computeStreak(days) : 0;
  const today = days ? todayMinutes(days) : 0;
  const goalProgress = Math.min(100, dailyGoalMinutes > 0 ? (today / dailyGoalMinutes) * 100 : 0);
  const maxMinutes = days ? Math.max(1, ...days.map((d) => d.minutes)) : 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 border-none bg-popover/95 px-0 pb-6 pt-3 shadow-2xl backdrop-blur-xl"
      >
        <SheetHeader className="px-5 pb-3">
          <SheetTitle className="text-[15px]">Okuma İstatistiklerin</SheetTitle>
        </SheetHeader>

        {days && (
          <div className="flex flex-col gap-6 overflow-y-auto px-5">
            <div className="flex flex-col gap-2">
              <p className="text-[13px] leading-snug text-foreground">{todaySummary(today)}</p>
              {streak >= 2 && (
                <p className="text-[13px] leading-snug text-foreground">
                  🔥 {streak} gündür art arda okuyorsun — güzel gidiyor.
                </p>
              )}
            </div>

            <section className="flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Son 7 gün
              </p>
              <div className="flex items-end justify-between gap-1.5 px-1">
                {days.map((d) => {
                  const weekday = new Date(d.date).getDay(); // 0=Sun..6=Sat
                  const label = WEEKDAY_LABELS[(weekday + 6) % 7];
                  const heightPct = Math.max(6, (d.minutes / maxMinutes) * 100);
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-16 w-full items-end">
                        <div
                          className={cn(
                            "w-full rounded-t-[3px] transition-all",
                            d.minutes > 0 ? "bg-primary/70" : "bg-muted"
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Günlük Hedef
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Hedefi azalt"
                    onClick={() => setDailyGoalMinutes(Math.max(5, dailyGoalMinutes - 5))}
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-16 text-center text-[12px] tabular-nums text-foreground">
                    {dailyGoalMinutes} dk
                  </span>
                  <button
                    type="button"
                    aria-label="Hedefi artır"
                    onClick={() => setDailyGoalMinutes(dailyGoalMinutes + 5)}
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              {goalProgress >= 100 && (
                <p className="text-[12px] text-muted-foreground">
                  Bugünkü hedefine ulaştın, ne güzel 🎉
                </p>
              )}
            </section>

            <section className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="text-sm text-foreground">Nazik mola hatırlatmaları</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  Uzun bir okuma seansında, istersen sana kısa bir mola önerelim.
                </span>
              </div>
              <Switch
                checked={breakRemindersEnabled}
                onCheckedChange={setBreakRemindersEnabled}
              />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
