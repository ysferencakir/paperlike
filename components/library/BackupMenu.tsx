"use client";

import { useRef, useState } from "react";
import { DownloadCloud, Loader2, UploadCloud } from "lucide-react";
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
import { exportLibrary, importLibrary } from "@/lib/backup";
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
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBusy(true);
    try {
      const zip = await exportLibrary();
      await shareFile(zip, backupFilename(), t("backup.shareTitle"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("backup.exportFailed");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    try {
      const { bookCount } = await importLibrary(file, t);
      await refresh();
      toast.success(
        bookCount === 1 ? t("backup.restoredOne") : t("backup.restoredMany", { count: bookCount })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t("backup.importFailed");
      toast.error(message);
    } finally {
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
    </>
  );
}
