"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Picks up the app icon's "Continue reading" long-press shortcut (see
 * ShortcutPlugin/MainActivity) and jumps straight into that book's reader.
 */
export function ShortcutHandler() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    (async () => {
      const { Capacitor, registerPlugin } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const plugin = registerPlugin<{
        addListener: (
          eventName: "shortcutOpened",
          cb: (event: { bookId: string }) => void
        ) => Promise<{ remove: () => void }>;
      }>("Shortcuts");

      const listener = await plugin.addListener("shortcutOpened", (event) => {
        router.push(`/reader?bookId=${event.bookId}`);
      });

      if (cancelled) listener.remove();
      else sub = listener;
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [router]);

  return null;
}
