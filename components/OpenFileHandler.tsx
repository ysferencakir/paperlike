"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { importBookFile } from "@/lib/import-book";
import { toast } from "@/store/useToastStore";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface FileOpenedEvent {
  uri: string;
  mimeType: string | null;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  epub: "application/epub+zip",
  pdf: "application/pdf",
};
const EXTENSION_BY_MIME: Record<string, string> = {
  "application/epub+zip": "epub",
  "application/x-epub+zip": "epub",
  "application/pdf": "pdf",
};

/**
 * File managers vary in what mimeType they actually report for an .epub —
 * some say application/epub+zip, some application/x-epub+zip, some just
 * fall back to application/octet-stream since epub is a zip file
 * underneath (see the AndroidManifest comment on the intent-filters this
 * feeds from). The URI's own file extension is the one thing that's
 * actually reliable, so it's tried first; the mimeType is only a fallback.
 */
function detectExtension(uri: string, mimeType: string | null): "epub" | "pdf" | undefined {
  const fromUri = uri.toLowerCase().match(/\.(epub|pdf)(?:$|[?#])/)?.[1];
  if (fromUri === "epub" || fromUri === "pdf") return fromUri;
  const fromMime = mimeType ? EXTENSION_BY_MIME[mimeType] : undefined;
  return fromMime === "epub" || fromMime === "pdf" ? fromMime : undefined;
}

/**
 * Picks up files launched via "Open with Paperlike" (see the VIEW
 * intent-filter in AndroidManifest.xml + OpenFilePlugin/MainActivity),
 * reads the native content:// / file:// URI through @capacitor/filesystem,
 * and imports it into the library exactly like a manual upload would.
 */
export function OpenFileHandler() {
  const router = useRouter();
  const { t } = useTranslation();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    (async () => {
      const { Capacitor, registerPlugin } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { Filesystem } = await import("@capacitor/filesystem");

      const plugin = registerPlugin<{
        addListener: (
          eventName: "fileOpened",
          cb: (event: FileOpenedEvent) => void
        ) => Promise<{ remove: () => void }>;
      }>("OpenFile");

      const listener = await plugin.addListener("fileOpened", (event) => {
        void (async () => {
          try {
            const ext = detectExtension(event.uri, event.mimeType);
            if (!ext) throw new Error(tRef.current("openFile.unsupportedType"));
            const mimeType = MIME_BY_EXTENSION[ext];
            // Native always returns base64 (Blob is web-only, and this
            // handler only ever runs on a native platform — see the
            // isNativePlatform() guard above).
            const { data: base64 } = await Filesystem.readFile({ path: event.uri });
            const blobResponse = await fetch(`data:${mimeType};base64,${base64}`);
            const blob = await blobResponse.blob();
            const file = new File([blob], `${tRef.current("openFile.importedFilename")}.${ext}`, {
              type: mimeType,
            });
            const book = await importBookFile(file, tRef.current);
            toast.success(tRef.current("openFile.added"));
            router.push(`/reader?bookId=${book.id}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : tRef.current("openFile.failed");
            toast.error(message);
          }
        })();
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
