"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  initialPwaLifecycleState,
  reducePwaLifecycle,
} from "@/lib/pwa-lifecycle";
import {
  usePwaInstallStore,
  type BeforeInstallPromptEvent,
} from "@/store/usePwaInstallStore";

export function PwaRegistrar() {
  const { t } = useTranslation();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker>();
  const [dismissed, setDismissed] = useState(false);
  const [lifecycle, dispatch] = useReducer(
    reducePwaLifecycle,
    initialPwaLifecycleState
  );
  const updateRequested = useRef(false);
  const retryUpdate = useRef<() => Promise<void>>(async () => undefined);
  const setInstallPrompt = usePwaInstallStore((state) => state.setInstallPrompt);
  const setInstalled = usePwaInstallStore((state) => state.setInstalled);

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
    const standalone =
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => setInstalled(true);

    const showWaitingWorker = (worker: ServiceWorker | null) => {
      if (!cancelled && worker && navigator.serviceWorker.controller) {
        setWaitingWorker(worker);
        setDismissed(false);
        dispatch({ type: "UPDATE_READY" });
      }
    };
    const onInstallingStateChange = () => {
      if (installingWorker?.state === "installed") {
        if (navigator.serviceWorker.controller) {
          showWaitingWorker(registration?.waiting ?? installingWorker);
        } else {
          dispatch({ type: "CHECK_FINISHED" });
        }
      } else if (installingWorker?.state === "redundant") {
        setDismissed(false);
        dispatch({ type: "INSTALL_FAILED" });
      }
    };
    const onUpdateFound = () => {
      installingWorker?.removeEventListener("statechange", onInstallingStateChange);
      installingWorker = registration?.installing ?? undefined;
      dispatch({ type: "UPDATE_FOUND" });
      installingWorker?.addEventListener("statechange", onInstallingStateChange);
      onInstallingStateChange();
    };
    const onControllerChange = () => {
      dispatch({ type: "CONTROLLER_CHANGED" });
      if (updateRequested.current) window.location.reload();
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "PWA_CACHE_ERROR") {
        setDismissed(false);
        dispatch({ type: "CACHE_FAILED" });
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const registerOrUpdate = async () => {
      dispatch({ type: "CHECK_STARTED" });
      try {
        if (registration) {
          await registration.update();
        } else {
          registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          if (cancelled) return;
          registration.addEventListener("updatefound", onUpdateFound);
        }

        showWaitingWorker(registration.waiting);
        if (registration.installing) onUpdateFound();
        else if (!registration.waiting) dispatch({ type: "CHECK_FINISHED" });
      } catch (error) {
        if (cancelled) return;
        console.error("Service worker registration failed", error);
        setDismissed(false);
        dispatch({ type: "REGISTRATION_FAILED" });
      }
    };
    retryUpdate.current = registerOrUpdate;
    void registerOrUpdate();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onServiceWorkerMessage);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      registration?.removeEventListener("updatefound", onUpdateFound);
      installingWorker?.removeEventListener("statechange", onInstallingStateChange);
    };
  }, [setInstallPrompt, setInstalled]);

  const isError = lifecycle.status === "error";
  const isActivating = lifecycle.status === "activating";
  const canOfferUpdate = lifecycle.status === "ready" && waitingWorker;
  if (dismissed || (!isError && !isActivating && !canOfferUpdate)) return null;

  const applyUpdate = () => {
    if (!waitingWorker) return;
    updateRequested.current = true;
    dispatch({ type: "UPDATE_APPLYING" });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className="fixed inset-x-4 bottom-5 z-[110] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-xl"
    >
      {isError ? (
        <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden="true" />
      ) : isActivating ? (
        <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCw className="size-5 shrink-0" aria-hidden="true" />
      )}
      <p className="min-w-0 flex-1 text-sm">
        {isError
          ? t(lifecycle.error === "cache" ? "pwa.cacheFailed" : "pwa.updateFailed")
          : isActivating
            ? t("pwa.updating")
            : t("pwa.updateReady")}
      </p>
      {!isActivating && (
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            if (isError) dispatch({ type: "DISMISS_ERROR" });
          }}
          className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          {t("pwa.later")}
        </button>
      )}
      {isError && lifecycle.error !== "cache" ? (
        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            void retryUpdate.current();
          }}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          {t("pwa.retry")}
        </button>
      ) : canOfferUpdate ? (
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          {t("pwa.update")}
        </button>
      ) : null}
    </div>
  );
}
