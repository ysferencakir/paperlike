"use client";

import { useEffect } from "react";
import { initAuthListener } from "@/store/useAuthStore";

/**
 * Subscribes once, at the app root, to Firebase's authStateChange stream so
 * useAuthStore always reflects who's signed in — mirrors the pattern used by
 * the other singleton handlers (BackButtonHandler, OpenFileHandler, etc.).
 */
export function AuthHandler() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void initAuthListener().then((c) => {
      if (cancelled) c();
      else cleanup = c;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
