"use client";

import { useEffect } from "react";
import {
  recordException,
  setCrashReportingCollectionEnabled,
} from "@/lib/native-ui";
import { usePrivacyStore } from "@/store/usePrivacyStore";

/**
 * Forwards otherwise-invisible JS runtime errors to Crashlytics — without
 * this, the only way to see a crash a real user hit is asking them to
 * plug the phone in and attach chrome://inspect.
 */
export function CrashReportingHandler() {
  useEffect(() => {
    const preference = usePrivacyStore.getState().crashReportingEnabled;
    void setCrashReportingCollectionEnabled(preference).catch(() => {
      // Preference stays persisted and is retried on the next launch.
    });

    const onError = (event: ErrorEvent) => {
      if (usePrivacyStore.getState().crashReportingEnabled) {
        void recordException(event.error ?? event.message).catch(() => {
          // Never turn reporting failure into another unhandled rejection.
        });
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (usePrivacyStore.getState().crashReportingEnabled) {
        void recordException(event.reason).catch(() => {
          // Never recursively report a reporting failure.
        });
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
