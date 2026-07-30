"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function PwaRegistrar() {
  useEffect(() => {
    if (
      Capacitor.isNativePlatform() ||
      !("serviceWorker" in navigator) ||
      !["http:", "https:"].includes(window.location.protocol)
    ) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  return null;
}
