"use client";

import { useState } from "react";
import { Info, MoreHorizontal, PenLine } from "lucide-react";
import type { Book } from "@/lib/types";
import { useLibraryStore } from "@/store/useLibraryStore";
import { toast } from "@/store/useToastStore";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const FORMAT_LABEL: Record<Book["format"], string> = {
  epub: "EPUB",
  pdf: "PDF",
};

const TRIGGER_CLASSES = {
  overlay:
    "absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-black/60 group-hover:opacity-100 focus-visible:opacity-100 data-open:opacity-100",
  inline:
    "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all duration-150 hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 data-open:opacity-100",
};

export function BookActionsMenu({
  book,
  variant = "overlay",
}: {
  book: Book;
  variant?: "overlay" | "inline";
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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
              aria-label="Kitap seçenekleri"
              className={TRIGGER_CLASSES[variant]}
            />
          }
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6}>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <PenLine />
            Yeniden Adlandır
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setInfoOpen(true)}>
            <Info />
            Bilgi
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog book={book} open={renameOpen} onOpenChange={setRenameOpen} />

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Kitap Bilgisi</DialogTitle>
          </DialogHeader>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="Başlık" value={book.title} />
            <Row label="Yazar" value={book.author} />
            <Row label="Kategori" value={book.category ?? "Kategorisiz"} />
            <Row label="Format" value={FORMAT_LABEL[book.format]} />
            <Row label="Boyut" value={formatBytes(book.fileSize)} />
            <Row label="Eklenme Tarihi" value={new Date(book.addedAt).toLocaleDateString("tr-TR")} />
          </dl>
        </DialogContent>
      </Dialog>
    </>
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
  const books = useLibraryStore((s) => s.books);
  const renameBook = useLibraryStore((s) => s.renameBook);
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [category, setCategory] = useState(book.category ?? "");
  const [saving, setSaving] = useState(false);

  const existingCategories = Array.from(
    new Set(books.map((b) => b.category).filter((c): c is string => !!c))
  ).sort((a, b) => a.localeCompare(b, "tr"));

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
        author: author.trim() || "Bilinmeyen Yazar",
        category: category.trim() || undefined,
      });
      toast.success("Kitap güncellendi.");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Kitabı Düzenle</DialogTitle>
          <DialogDescription>Başlığı, yazarı ve rafta göründüğü kategoriyi düzenle.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Başlık</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Yazar</span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Kategori</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="ör. Roman, Bilim Kurgu"
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
            Vazgeç
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !title.trim()}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
