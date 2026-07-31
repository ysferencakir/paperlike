"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Book } from "@/lib/types";
import { useLibraryStore } from "@/store/useLibraryStore";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";
import { BookCover } from "./BookCover";
import { BookActionsMenu } from "./BookActionsMenu";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function BookListRow({ book, editMode = false }: { book: Book; editMode?: boolean }) {
  const { t } = useTranslation();
  const removeBook = useLibraryStore((s) => s.removeBook);
  const [confirming, setConfirming] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      resetTimer.current = setTimeout(() => setConfirming(false), 2500);
      return;
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    void removeBook(book.id).then(() => toast.message(t("book.deleted")));
  };

  return (
    <Link
      href={`/reader?bookId=${book.id}`}
      className="group flex items-center gap-3.5 rounded-xl px-2 py-2 hover:bg-muted"
    >
      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-black/5">
        <BookCover book={book} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[13px] font-medium text-foreground">{book.title}</p>
        <p className="truncate text-[12px] text-muted-foreground">{book.author}</p>
      </div>

      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
        {t(book.format === "epub" ? "format.epub" : "format.pdf")}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        {confirming && (
          <span className="rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
            {t("book.confirmDelete")}
          </span>
        )}
        <BookActionsMenu book={book} variant="inline" forceVisible={editMode} />
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label={confirming ? t("book.confirmDelete") : t("book.delete")}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-all duration-150",
            editMode ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            confirming
              ? "bg-destructive text-destructive-foreground opacity-100"
              : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </Link>
  );
}
