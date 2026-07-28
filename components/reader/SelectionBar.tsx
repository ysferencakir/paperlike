"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Star, X } from "lucide-react";
import { HIGHLIGHT_COLORS, type ImportanceLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SelectionPayload } from "./types";

const IMPORTANCE_LEVELS: ImportanceLevel[] = [1, 2, 3];

export function SelectionBar({
  selection,
  onConfirm,
  onDismiss,
}: {
  selection: SelectionPayload;
  onConfirm: (color: string, importance: ImportanceLevel) => void;
  onDismiss: () => void;
}) {
  const [color, setColor] = useState<string>(HIGHLIGHT_COLORS[0]);
  const [importance, setImportance] = useState<ImportanceLevel>(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute inset-x-0 bottom-4 z-30 flex justify-center px-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-black/5 bg-popover/95 p-3.5 shadow-lg ring-1 ring-foreground/5 backdrop-blur-xl dark:border-white/5">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 flex-1 text-[12.5px] italic leading-snug text-muted-foreground">
            &ldquo;{selection.text}&rdquo;
          </p>
          <button
            type="button"
            aria-label="Vazgeç"
            onClick={onDismiss}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`${c} rengi seç`}
                onClick={() => setColor(c)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full ring-1 ring-black/10 transition-transform hover:scale-110",
                  color === c && "scale-110 ring-2 ring-foreground/60"
                )}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="size-3 text-black/60" strokeWidth={3} />}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5">
            {IMPORTANCE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-label={`Önem seviyesi ${level}`}
                onClick={() => setImportance((prev) => (prev === level ? 0 : level))}
                className="flex size-6 items-center justify-center text-muted-foreground transition-colors hover:text-amber-500"
              >
                <Star
                  className={cn("size-4", importance >= level && "fill-amber-400 text-amber-500")}
                />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onConfirm(color, importance)}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: color, color: "#1a1a1a" }}
        >
          Vurgula
        </button>
      </div>
    </motion.div>
  );
}
