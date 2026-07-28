"use client";

/** A tiny "book seen from the side" cue — read pages vs. remaining pages. */
export function PageThicknessIndicator({ percentage }: { percentage: number }) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const leftWidth = 3 + (clamped / 100) * 21;
  const rightWidth = 3 + ((100 - clamped) / 100) * 21;

  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      <div
        className="h-3 rounded-l-[2px]"
        style={{
          width: leftWidth,
          background:
            "repeating-linear-gradient(90deg, color-mix(in oklch, var(--reader-fg), transparent 45%) 0 1px, color-mix(in oklch, var(--reader-fg), transparent 70%) 1px 2px)",
        }}
      />
      <div
        className="h-3.5 w-[1.5px] rounded-full"
        style={{ backgroundColor: "color-mix(in oklch, var(--reader-fg), transparent 25%)" }}
      />
      <div
        className="h-3 rounded-r-[2px]"
        style={{
          width: rightWidth,
          background:
            "repeating-linear-gradient(90deg, color-mix(in oklch, var(--reader-fg), transparent 60%) 0 1px, color-mix(in oklch, var(--reader-fg), transparent 82%) 1px 2px)",
        }}
      />
    </div>
  );
}
