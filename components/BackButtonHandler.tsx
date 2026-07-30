"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBackHandlerStore } from "@/store/useBackHandlerStore";

/**
 * Wires the Android hardware/gesture back button to the app's own
 * navigation instead of Capacitor's default (which just closes the app).
 * Whatever's on screen can register a handler via useBackHandlerStore to
 * intercept the press first (e.g. the reader closing an open panel); if
 * nothing does, this falls back to "go to the library" and, from there,
 * "exit the app" — the same two-step behavior every native Android app has.
 */
export function BackButtonHandler() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("backButton", () => {
        const handler = useBackHandlerStore.getState().handler;
        if (handler?.()) return;
        if (window.location.pathname !== "/") {
          router.push("/");
          return;
        }
        void App.exitApp();
      });
      if (cancelled) listener.remove();
      else sub = listener;
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [router]);

  return null;
}
