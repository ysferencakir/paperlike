"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSyncStatusStore } from "@/store/useSyncStatusStore";

export function SyncStatusCard() {
  const { t } = useTranslation();
  const phase = useSyncStatusStore((state) => state.phase);
  const pendingCount = useSyncStatusStore((state) => state.pendingCount);
  const lastErrorCode = useSyncStatusStore((state) => state.lastErrorCode);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { flushCurrentUserSyncOutbox } = await import("@/lib/cloud-sync");
      await flushCurrentUserSyncOutbox();
    } finally {
      setRetrying(false);
    }
  };

  const label =
    phase === "syncing"
      ? t("syncStatus.syncing")
      : phase === "retrying"
        ? t("syncStatus.retrying")
        : phase === "attention"
          ? t("syncStatus.attention")
          : t("syncStatus.idle");

  return (
    <section className="rounded-lg border border-border p-3" aria-live="polite">
      <p className="text-sm font-medium">{t("syncStatus.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {pendingCount > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("syncStatus.pending").replace("{count}", String(pendingCount))}
        </p>
      )}
      {lastErrorCode && (
        <p className="mt-1 text-xs text-muted-foreground">
          {lastErrorCode === "permission-denied"
            ? t("syncStatus.permission")
            : lastErrorCode === "quota-exceeded"
              ? t("syncStatus.quota")
              : t("syncStatus.network")}
        </p>
      )}
      {phase !== "idle" && (
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => void handleRetry()}
          disabled={retrying || phase === "syncing"}
        >
          {retrying ? t("syncStatus.retryingNow") : t("syncStatus.retryNow")}
        </Button>
      )}
    </section>
  );
}
