"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { setCrashReportingCollectionEnabled } from "@/lib/native-ui";
import { usePrivacyStore } from "@/store/usePrivacyStore";
import { toast } from "@/store/useToastStore";

export function CrashReportingConsent() {
  const { t } = useTranslation();
  const enabled = usePrivacyStore((state) => state.crashReportingEnabled);
  const setEnabled = usePrivacyStore((state) => state.setCrashReportingEnabled);
  const [isNative, setIsNative] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (active) setIsNative(Capacitor.isNativePlatform());
      })
      .catch(() => {
        // Web or a stale native shell: the unavailable control stays hidden.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isNative) return null;

  const handleChange = async (checked: boolean) => {
    // Persist the user's privacy choice immediately. If the native bridge is
    // temporarily unavailable, startup applies the same choice again later.
    setEnabled(checked);
    setBusy(true);
    try {
      await setCrashReportingCollectionEnabled(checked);
      toast.success(
        checked
          ? t("privacy.crashReportingEnabled")
          : t("privacy.crashReportingDisabled")
      );
    } catch {
      toast.error(t("privacy.crashReportingApplyError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border p-3" aria-labelledby="crash-reporting-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="crash-reporting-title" className="text-sm font-medium text-foreground">
            {t("privacy.crashReportingTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("privacy.crashReportingDescription")}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => void handleChange(checked)}
          disabled={busy}
          aria-label={t("privacy.crashReportingToggle")}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {enabled
          ? t("privacy.crashReportingEnabledDetail")
          : t("privacy.crashReportingDisabledDetail")}
      </p>
    </section>
  );
}
