"use client";

import { useEffect } from "react";
import { initAuthListener } from "@/store/useAuthStore";
import { getFirebaseApp, setFirebaseIsNativePlatform } from "@/lib/firebase";
import { useSettingsStore } from "@/store/useSettingsStore";

const SETTINGS_PUSH_DEBOUNCE_MS = 800;

/**
 * Subscribes once, at the app root, to Firebase's authStateChange stream so
 * useAuthStore always reflects who's signed in — mirrors the pattern used by
 * the other singleton handlers (BackButtonHandler, OpenFileHandler, etc.).
 * Also keeps reader settings pushed to Firestore while signed in, debounced
 * so dragging a slider doesn't fire a write per tick.
 */
export function AuthHandler() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      setFirebaseIsNativePlatform(Capacitor.isNativePlatform());
      // Must run before any FirebaseAuthentication call — its web
      // implementation expects the default Firebase app to already exist.
      getFirebaseApp();
      const c = await initAuthListener();
      if (cancelled) c();
      else cleanup = c;
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useSettingsStore.subscribe(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void import("@/lib/cloud-sync").then((m) => m.pushSettingsSnapshot().catch(console.error));
      }, SETTINGS_PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  useEffect(() => {
    const flushOutbox = () => {
      void import("@/lib/cloud-sync").then((module) =>
        module.flushCurrentUserSyncOutbox().catch(console.error)
      );
    };
    window.addEventListener("online", flushOutbox);
    return () => window.removeEventListener("online", flushOutbox);
  }, []);

  return null;
}
