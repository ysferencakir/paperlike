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

export function BookCard({ book, editMode = false }: { book: Book; editMode?: boolean }) {
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
    <Link href={`/reader?bookId=${book.id}`} className="group flex flex-col gap-2.5">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-black/10">
        <BookCover book={book} />

        <span className="absolute left-2 top-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white opacity-100 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-0">
          {t(book.format === "epub" ? "format.epub" : "format.pdf")}
        </span>

        <BookActionsMenu book={book} forceVisible={editMode} />

        {confirming && (
          <span className="absolute right-11 top-2.5 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground shadow-sm">
            {t("book.confirmDelete")}
          </span>
        )}

        <button
          type="button"
          onClick={handleDeleteClick}
          className={cn(
            "absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-white backdrop-blur-sm transition-all duration-200",
            editMode ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            confirming ? "bg-destructive opacity-100" : "bg-black/40 hover:bg-black/60"
          )}
          aria-label={confirming ? t("book.confirmDelete") : t("book.delete")}
        >
          <Trash2 className="size-3.5" />
        </button>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/0 via-black/0 to-black/0 transition-colors group-hover:from-black/10" />
      </div>

      <div className="flex flex-col gap-0.5 px-0.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
          {book.title}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">{book.author}</p>
      </div>
    </Link>
  );
}
