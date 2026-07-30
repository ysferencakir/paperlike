import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Translate } from "./i18n/useTranslation"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/** crypto.randomUUID() is only defined in secure contexts (https/localhost); this
 *  falls back to crypto.getRandomValues (or Math.random as a last resort) so ID
 *  generation still works over plain http, e.g. testing on a phone via LAN IP. */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

/** `t` is the i18n `t()` function — passed in rather than imported, since
 *  this is a plain helper (not a hook) that can't call useTranslation() itself. */
export function formatRelativeDate(timestamp: number, t: Translate): string {
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000))
  if (days <= 0) return t("relativeDate.today")
  if (days === 1) return t("relativeDate.yesterday")
  if (days < 30) return t("relativeDate.daysAgo", { days })
  const months = Math.floor(days / 30)
  if (months < 12) return t("relativeDate.monthsAgo", { months })
  return t("relativeDate.yearsAgo", { years: Math.floor(months / 12) })
}
