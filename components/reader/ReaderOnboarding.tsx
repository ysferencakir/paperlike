"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * One-time overlay shown the very first time a book is opened, explaining
 * the two gestures that aren't otherwise discoverable: swipe to turn pages
 * and tap to toggle the menu (there are no visible buttons/arrows for
 * either — see EpubReaderSurface/PdfReaderSurface's swipe-only handling).
 */
export function ReaderOnboarding({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/80 px-8 text-center backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3">
        <ArrowLeftRight className="size-8 text-white" />
        <p className="text-sm text-white/90">{t("onboarding.swipe")}</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Hand className="size-8 text-white" />
        <p className="text-sm text-white/90">{t("onboarding.tap")}</p>
      </div>
      <Button size="sm" onClick={onDismiss} className="mt-2">
        {t("onboarding.gotIt")}
      </Button>
    </motion.div>
  );
}
