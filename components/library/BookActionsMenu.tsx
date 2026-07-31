"use client";

import { useState } from "react";
import { Info, MoreHorizontal, PenLine, Trash2 } from "lucide-react";
import type { Book } from "@/lib/types";
import { useLibraryStore } from "@/store/useLibraryStore";
import { toast } from "@/store/useToastStore";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const TRIGGER_CLASSES = {
  overlay:
    "absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/60",
  inline:
    "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground",
};

export function BookActionsMenu({
  book,
  variant = "overlay",
  forceVisible = false,
}: {
  book: Book;
  variant?: "overlay" | "inline";
  /** Skip the hover-only reveal and keep the trigger visible — used in "edit library" mode for touch devices, which have no hover state. */
  forceVisible?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const formatLabel = t(book.format === "epub" ? "format.epub" : "format.pdf");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              aria-label={t("bookActions.ariaLabel")}
              className={cn(
                TRIGGER_CLASSES[variant],
                forceVisible
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-open:opacity-100"
              )}
            />
          }
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6}>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <PenLine />
            {t("bookActions.rename")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setInfoOpen(true)}>
            <Info />
            {t("bookActions.info")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            {t("book.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog book={book} open={renameOpen} onOpenChange={setRenameOpen} />
      <DeleteDialog book={book} open={deleteOpen} onOpenChange={setDeleteOpen} />

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{t("bookActions.infoTitle")}</DialogTitle>
          </DialogHeader>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label={t("bookActions.titleLabel")} value={book.title} />
            <Row label={t("bookActions.authorLabel")} value={book.author} />
            <Row
              label={t("bookActions.categoryLabel")}
              value={book.category ?? t("bookActions.uncategorized")}
            />
            <Row label={t("bookActions.formatLabel")} value={formatLabel} />
            <Row label={t("bookActions.sizeLabel")} value={formatBytes(book.fileSize)} />
            <Row
              label={t("bookActions.addedAtLabel")}
              value={new Date(book.addedAt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US")}
            />
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteDialog({
  book,
  open,
  onOpenChange,
}: {
  book: Book;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const removeBook = useLibraryStore((s) => s.removeBook);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeBook(book.id);
      toast.message(t("book.deleted"));
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("book.confirmDelete")}</DialogTitle>
          <DialogDescription>{book.title}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
            {t("book.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function RenameDialog({
  book,
  open,
  onOpenChange,
}: {
  book: Book;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { t, locale } = useTranslation();
  const books = useLibraryStore((s) => s.books);
  const renameBook = useLibraryStore((s) => s.renameBook);
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [category, setCategory] = useState(book.category ?? "");
  const [saving, setSaving] = useState(false);

  const existingCategories = Array.from(
    new Set(books.map((b) => b.category).filter((c): c is string => !!c))
  ).sort((a, b) => a.localeCompare(b, locale === "tr" ? "tr" : "en"));

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setTitle(book.title);
      setAuthor(book.author);
      setCategory(book.category ?? "");
    }
    onOpenChange(value);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      await renameBook(book.id, {
        title: trimmedTitle,
        author: author.trim() || t("bookActions.unknownAuthor"),
        category: category.trim() || undefined,
      });
      toast.success(t("bookActions.updated"));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("bookActions.editTitle")}</DialogTitle>
          <DialogDescription>{t("bookActions.editDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              {t("bookActions.titleLabel")}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              {t("bookActions.authorLabel")}
            </span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              {t("bookActions.categoryLabel")}
            </span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("bookActions.categoryPlaceholder")}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {/* Plain buttons, not a native <datalist> — the browser's own
                autocomplete popup momentarily pulls focus outside the
                dialog's DOM, which trips its focus trap and closes it. */}
            {existingCategories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {existingCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !title.trim()}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
