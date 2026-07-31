"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  formatStorageBytes,
  getAvailableStorage,
  getWebStorageSnapshot,
  isStorageLow,
  requestPersistentWebStorage,
  type WebStorageSnapshot,
} from "@/lib/pwa-storage";
import { usePwaInstallStore } from "@/store/usePwaInstallStore";

const subscribeToBrowser = () => () => undefined;

function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PwaStorageButton() {
  const { t, locale } = useTranslation();
  const installPrompt = usePwaInstallStore((state) => state.installPrompt);
  const installed = usePwaInstallStore((state) => state.installed);
  const requestInstall = usePwaInstallStore((state) => state.requestInstall);
  const isBrowser = useSyncExternalStore(
    subscribeToBrowser,
    () => true,
    () => false
  );
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<WebStorageSnapshot | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [requestingPersistence, setRequestingPersistence] = useState(false);
  const [persistenceDenied, setPersistenceDenied] = useState(false);

  const refreshStorage = useCallback(async () => {
    setLoadingStorage(true);
    try {
      setSnapshot(await getWebStorageSnapshot());
    } catch {
      setSnapshot({ supported: false, persisted: null, usage: null, quota: null });
    } finally {
      setLoadingStorage(false);
    }
  }, []);

  const isWeb =
    isBrowser &&
    !Capacitor.isNativePlatform() &&
    ["http:", "https:"].includes(window.location.protocol);
  if (!isWeb) return null;

  const usage = snapshot?.usage;
  const quota = snapshot?.quota;
  const available = snapshot ? getAvailableStorage(snapshot) : null;
  const percentage =
    usage !== null && usage !== undefined && quota
      ? Math.min(100, Math.round((usage / quota) * 100))
      : 0;
  const lowStorage = snapshot ? isStorageLow(snapshot) : false;

  const requestPersistence = async () => {
    setRequestingPersistence(true);
    setPersistenceDenied(false);
    try {
      const granted = await requestPersistentWebStorage();
      setPersistenceDenied(granted !== true);
      await refreshStorage();
    } catch {
      setPersistenceDenied(true);
    } finally {
      setRequestingPersistence(false);
    }
  };

  const setDialogOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void refreshStorage();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("pwa.toolsAriaLabel")}
        onClick={() => setDialogOpen(true)}
      >
        <HardDrive className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pwa.toolsTitle")}</DialogTitle>
            <DialogDescription>{t("pwa.toolsDescription")}</DialogDescription>
          </DialogHeader>

          <section className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Download className="size-4" aria-hidden="true" />
              <h3 className="font-medium">{t("pwa.installTitle")}</h3>
            </div>
            {installed ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t("pwa.installed")}
              </p>
            ) : installPrompt ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("pwa.installDescription")}</p>
                <Button size="sm" onClick={() => void requestInstall()}>
                  <Download className="size-4" />
                  {t("pwa.install")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isIosBrowser() ? t("pwa.installIosHint") : t("pwa.installBrowserHint")}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" />
              <h3 className="font-medium">{t("pwa.storageTitle")}</h3>
            </div>

            {loadingStorage && !snapshot ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t("pwa.storageLoading")}
              </p>
            ) : !snapshot?.supported ? (
              <p className="text-sm text-muted-foreground">{t("pwa.storageUnsupported")}</p>
            ) : (
              <div className="space-y-3">
                {typeof usage === "number" && typeof quota === "number" && (
                  <div>
                    <div className="mb-1 flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>
                        {t("pwa.storageUsed", {
                          usage: formatStorageBytes(usage, locale),
                          quota: formatStorageBytes(quota, locale),
                        })}
                      </span>
                      <span>{percentage}%</span>
                    </div>
                    <Progress value={percentage} aria-label={t("pwa.storageUsageAriaLabel")} />
                    {available !== null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("pwa.storageAvailable", {
                          available: formatStorageBytes(available, locale),
                        })}
                      </p>
                    )}
                  </div>
                )}

                {lowStorage && (
                  <p className="flex gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {t("pwa.storageLow")}
                  </p>
                )}

                {snapshot.persisted ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {t("pwa.storagePersistent")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t("pwa.storagePersistenceDescription")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={requestingPersistence}
                      onClick={() => void requestPersistence()}
                    >
                      {requestingPersistence && (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      )}
                      {t("pwa.storageRequestPersistence")}
                    </Button>
                    {persistenceDenied && (
                      <p className="text-xs text-muted-foreground">
                        {t("pwa.storagePersistenceDenied")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground">{t("pwa.storageNotBackup")}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
