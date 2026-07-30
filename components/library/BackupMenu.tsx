"use client";

import { useRef, useState } from "react";
import { DownloadCloud, Loader2, UploadCloud, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  exportLibrary,
  importLibrary,
  isBackupAbortError,
  type BackupProgress,
} from "@/lib/backup";
import { shareFile } from "@/lib/native-ui";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useLocaleStore, type Locale } from "@/store/useLocaleStore";
import { toast } from "@/store/useToastStore";
import { useTranslation } from "@/lib/i18n/useTranslation";

function backupFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `paperlike-yedek-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.zip`;
}

export function BackupMenu() {
  const { t } = useTranslation();
  const refresh = useLibraryStore((s) => s.refresh);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const stageLabel = (stage: BackupProgress["stage"]) => {
    switch (stage) {
      case "collecting":
        return t("backup.progressCollecting");
      case "compressing":
        return t("backup.progressCompressing");
      case "validating":
        return t("backup.progressValidating");
      case "restoring":
        return t("backup.progressRestoring");
      case "metadata":
        return t("backup.progressMetadata");
    }
  };

  const handleExport = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setProgress(null);
    try {
      const zip = await exportLibrary({
        signal: controller.signal,
        onProgress: setProgress,
      });
      await shareFile(zip, backupFilename(), t("backup.shareTitle"));
    } catch (err) {
      if (isBackupAbortError(err)) toast.message(t("backup.cancelled"));
      else {
        const message = err instanceof Error ? err.message : t("backup.exportFailed");
        toast.error(message);
      }
    } finally {
      controllerRef.current = null;
      setProgress(null);
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setProgress(null);
    try {
      const { bookCount } = await importLibrary(file, t, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      await refresh();
      toast.success(
        bookCount === 1 ? t("backup.restoredOne") : t("backup.restoredMany", { count: bookCount })
      );
    } catch (err) {
      if (isBackupAbortError(err)) toast.message(t("backup.cancelled"));
      else {
        const message = err instanceof Error ? err.message : t("backup.importFailed");
        toast.error(message);
      }
    } finally {
      controllerRef.current = null;
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t("backup.ariaLabel")} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <DownloadCloud className="size-4" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void handleExport()}>
            <DownloadCloud className="size-4" />
            {t("backup.export")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
            <UploadCloud className="size-4" />
            {t("backup.import")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
          >
            <DropdownMenuRadioItem value="tr">{t("language.turkish")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">{t("language.english")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={importInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleImportFile(file);
        }}
      />

      {busy && progress && (
        <div
          className="fixed right-4 top-16 z-[110] w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover/95 p-4 shadow-2xl backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{stageLabel(progress.stage)}</p>
              {progress.currentBook && (
                <p className="truncate text-xs text-muted-foreground">{progress.currentBook}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("backup.cancel")}
              onClick={() => controllerRef.current?.abort()}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percentage}
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
            {progress.percentage}%
          </p>
        </div>
      )}
    </>
  );
}
