"use client";

import { useState } from "react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { toast } from "@/store/useToastStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Creating a category from a single book's edit dialog meant clicking into
 * every book one by one to build up a group. This does the reverse: pick a
 * name once, then check off every book that belongs to it in one pass.
 */
export function CategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const books = useLibraryStore((s) => s.books);
  const renameBook = useLibraryStore((s) => s.renameBook);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setName("");
      setSelected(new Set());
    }
    onOpenChange(value);
  };

  const toggleBook = (bookId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selected).map((bookId) => renameBook(bookId, { category: trimmedName }))
      );
      toast.success(t("category.created", { name: trimmedName }));
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("category.addTitle")}</DialogTitle>
          <DialogDescription>{t("category.addDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              {t("category.nameLabel")}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("category.namePlaceholder")}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("category.booksLabel")}{" "}
              {selected.size > 0 && t("category.selectedCount", { count: selected.size })}
            </span>
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {books.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  {t("category.noBooks")}
                </p>
              ) : (
                books.map((book) => (
                  <label
                    key={book.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(book.id)}
                      onChange={() => toggleBook(book.id)}
                      className="size-3.5 shrink-0 accent-foreground"
                    />
                    <span className="flex-1 truncate">{book.title}</span>
                    {book.category && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {book.category}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !name.trim() || selected.size === 0}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
