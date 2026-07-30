"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/store/useToastStore";
import { cn } from "@/lib/utils";

const ICONS: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex max-w-sm cursor-pointer items-center gap-2 rounded-full border border-black/5 bg-popover/95 px-4 py-2.5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 backdrop-blur-xl dark:border-white/5"
            >
              <Icon className={cn("size-4 shrink-0", VARIANT_CLASSES[t.variant])} />
              <span className="leading-snug">{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
