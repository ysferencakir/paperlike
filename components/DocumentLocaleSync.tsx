"use client";

import { useEffect } from "react";
import { useLocaleStore } from "@/store/useLocaleStore";

export function DocumentLocaleSync() {
  const locale = useLocaleStore((state) => state.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
