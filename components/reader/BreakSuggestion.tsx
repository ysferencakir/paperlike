"use client";

import { motion } from "framer-motion";
import { Coffee, X } from "lucide-react";

/**
 * A single, gentle, easy-to-ignore nudge — never a demand. Shown at most
 * once per reading sitting, fades away on its own if left alone.
 */
export function BreakSuggestion({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-black/5 bg-popover/95 px-4 py-3 shadow-lg ring-1 ring-foreground/5 backdrop-blur-xl dark:border-white/5">
        <Coffee className="size-4 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-[12.5px] leading-snug text-foreground">
          Bir süredir kitabının içindesin. Gözlerine küçük bir mola iyi gelebilir 🌿
        </p>
        <button
          type="button"
          aria-label="Kapat"
          onClick={onDismiss}
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
