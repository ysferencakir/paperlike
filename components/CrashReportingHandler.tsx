"use client";

import { useEffect } from "react";
import { recordException } from "@/lib/native-ui";

/**
 * Forwards otherwise-invisible JS runtime errors to Crashlytics — without
 * this, the only way to see a crash a real user hit is asking them to
 * plug the phone in and attach chrome://inspect.
 */
export function CrashReportingHandler() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => void recordException(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => void recordException(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
