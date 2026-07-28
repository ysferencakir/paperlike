import type { ReaderSettings, ReaderTheme } from "./types";

const NIGHT_START_HOUR = 20;
const NIGHT_END_HOUR = 7;

export function isNightHours(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

const BRIGHT_THEMES: ReaderTheme[] = ["light", "cream", "sepia"];

/** Resolves the theme actually rendered, applying auto night mode if enabled. */
export function resolveTheme(settings: ReaderSettings, date: Date = new Date()): ReaderTheme {
  if (settings.autoNightMode && isNightHours(date) && BRIGHT_THEMES.includes(settings.theme)) {
    return "coffee";
  }
  return settings.theme;
}

const THEME_COLORS: Record<Exclude<ReaderTheme, "custom">, { bg: string; fg: string }> = {
  light: { bg: "#ffffff", fg: "#1a1a1a" },
  cream: { bg: "#f7f3e9", fg: "#3a3226" },
  sepia: { bg: "#f4ecd8", fg: "#5b4636" },
  dark: { bg: "#1e1e1e", fg: "#e8e6e3" },
  coffee: { bg: "#2b2420", fg: "#d8c9b3" },
  "oled-black": { bg: "#000000", fg: "#d5d5d5" },
};

/**
 * Resolves literal bg/fg colors for the current theme. Passed down to
 * EpubReaderSurface as plain hex values instead of `var(--reader-fg)` —
 * CSS custom properties don't cross the iframe boundary that epub.js
 * renders content into, so a var() reference there always falls back
 * to black text, invisible on dark/oled-black/custom dark backgrounds.
 */
export function resolveColors(settings: ReaderSettings, date: Date = new Date()): { bg: string; fg: string } {
  const theme = resolveTheme(settings, date);
  if (theme === "custom") return { bg: settings.customBg, fg: settings.customFg };
  return THEME_COLORS[theme];
}
