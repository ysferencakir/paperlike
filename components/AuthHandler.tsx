"use client";

import { useEffect } from "react";
import { initAuthListener } from "@/store/useAuthStore";
import { getFirebaseApp, setFirebaseIsNativePlatform } from "@/lib/firebase";

/**
 * Subscribes once, at the app root, to Firebase's authStateChange stream so
 * useAuthStore always reflects who's signed in — mirrors the pattern used by
 * the other singleton handlers (BackButtonHandler, OpenFileHandler, etc.).
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

  return null;
}
