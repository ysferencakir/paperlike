"use client";

import { useCallback } from "react";
import { useLocaleStore } from "@/store/useLocaleStore";
import { tr } from "./tr";
import { en } from "./en";

const dictionaries = { tr, en };

/** The `t()` function's type, for plain (non-hook) helpers that need it passed in. */
export type Translate = (key: keyof typeof tr, vars?: Record<string, string | number>) => string;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/**
 * Flat-key i18n: `t("library.addBook")`, with `{placeholder}` interpolation
 * via `t("toast.booksImported", { count: 3 })`. Falls back to the Turkish
 * string (the "source of truth" — every key is authored in tr.ts first)
 * if a key is missing from the current locale, and to the raw key itself
 * if it's missing everywhere (so a typo shows up as visible broken text
 * instead of silently vanishing).
 */
export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = useCallback(
    (key: keyof typeof tr, vars?: Record<string, string | number>): string =>
      interpolate(dictionaries[locale][key] ?? tr[key] ?? key, vars),
    [locale]
  );

  return { t, locale, setLocale };
}

/**
 * Non-hook variant of `t()` for plain modules (e.g. lib/cloud-sync.ts) that
 * need a translated string outside of a React render — reads the current
 * locale directly from the store instead of subscribing to it.
 */
export function translate(key: keyof typeof tr, vars?: Record<string, string | number>): string {
  const locale = useLocaleStore.getState().locale;
  return interpolate(dictionaries[locale][key] ?? tr[key] ?? key, vars);
}
