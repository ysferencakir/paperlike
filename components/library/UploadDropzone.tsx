"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { importBookFile } from "@/lib/import-book";
import { useLibraryStore } from "@/store/useLibraryStore";
import { toast } from "@/store/useToastStore";

interface UploadDropzoneProps {
  compact?: boolean;
  onImported?: () => void;
}

export function UploadDropzone({ compact = false, onImported }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refresh = useLibraryStore((s) => s.refresh);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setIsImporting(true);
      const fileList = Array.from(files);
      let imported = 0;
      try {
        for (const file of fileList) {
          try {
            await importBookFile(file);
            imported++;
          } catch (err) {
            const message = err instanceof Error ? err.message : "Kitap içe aktarılamadı.";
            toast.error(`${file.name}: ${message}`);
            setError(message);
          }
        }
        if (imported > 0) {
          await refresh();
          toast.success(imported === 1 ? "Kitap eklendi." : `${imported} kitap eklendi.`);
          onImported?.();
        }
      } finally {
        setIsImporting(false);
      }
    },
    [refresh, onImported]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors",
          compact ? "p-6" : "p-16",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".epub,.pdf,application/epub+zip,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {isImporting ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="size-8 text-muted-foreground transition-colors group-hover:text-primary" />
        )}
        <div className="text-center">
          <p className="font-medium">
            {isImporting ? "Kitap içe aktarılıyor…" : "EPUB veya PDF yükleyin"}
          </p>
          <p className="text-sm text-muted-foreground">
            Sürükleyip bırakın ya da tıklayarak seçin
          </p>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
