"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function PwaRegistrar() {
  const { t } = useTranslation();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker>();
  const [dismissed, setDismissed] = useState(false);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (
      Capacitor.isNativePlatform() ||
      !("serviceWorker" in navigator) ||
      !["http:", "https:"].includes(window.location.protocol)
    ) {
      return;
    }

    let cancelled = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | undefined;

    const showWaitingWorker = (worker: ServiceWorker | null) => {
      if (!cancelled && worker && navigator.serviceWorker.controller) {
        setWaitingWorker(worker);
        setDismissed(false);
      }
    };
    const onInstallingStateChange = () => {
      if (installingWorker?.state === "installed") {
        showWaitingWorker(registration?.waiting ?? installingWorker);
      }
    };
    const onUpdateFound = () => {
      installingWorker?.removeEventListener("statechange", onInstallingStateChange);
      installingWorker = registration?.installing ?? undefined;
      installingWorker?.addEventListener("statechange", onInstallingStateChange);
    };
    const onControllerChange = () => {
      if (updateRequested.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((value) => {
        if (cancelled) return;
        registration = value;
        showWaitingWorker(registration.waiting);
        registration.addEventListener("updatefound", onUpdateFound);
      })
      .catch((error) => console.error("Service worker registration failed", error));

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
      installingWorker?.removeEventListener("statechange", onInstallingStateChange);
    };
  }, []);

  if (!waitingWorker || dismissed) return null;

  const applyUpdate = () => {
    updateRequested.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-5 z-[110] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-xl"
    >
      <RefreshCw className="size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">{t("pwa.updateReady")}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
      >
        {t("pwa.later")}
      </button>
      <button
        type="button"
        onClick={applyUpdate}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        {t("pwa.update")}
      </button>
    </div>
  );
}
