"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Check, LayoutGrid, Library, LibraryBig, List, Pencil, Plus, Search, Tag } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useLibraryViewStore } from "@/store/useLibraryViewStore";
import type { BookFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { syncStatusBar } from "@/lib/native-ui";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { UploadDropzone } from "./UploadDropzone";
import { BookCard } from "./BookCard";
import { BookListRow } from "./BookListRow";
import { ShelfView } from "./ShelfView";
import { ReadingStatsPanel } from "./ReadingStatsPanel";
import { CategoryDialog } from "./CategoryDialog";
import { BackupMenu } from "./BackupMenu";
import { AccountButton } from "./AccountButton";
import { PwaStorageButton } from "./PwaStorageButton";

type SortOption = "recent" | "title" | "author";
type FormatFilter = "all" | BookFormat;

export function LibraryView() {
  const { t, locale } = useTranslation();
  const { books, loaded, refresh } = useLibraryStore();
  const { viewMode, setViewMode } = useLibraryViewStore();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");

  const SORT_LABELS: Record<SortOption, string> = {
    recent: t("library.sortRecent"),
    title: t("library.sortTitle"),
    author: t("library.sortAuthor"),
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => void syncStatusBar(mq.matches ? "#0a0a0a" : "#fbfaf8");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const hasBooks = books.length > 0;

  const visibleBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = books;
    if (formatFilter !== "all") result = result.filter((b) => b.format === formatFilter);
    if (q) {
      result = result.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }
    const sorted = [...result];
    const compareLocale = locale === "tr" ? "tr" : "en";
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, compareLocale));
    else if (sort === "author") sorted.sort((a, b) => a.author.localeCompare(b.author, compareLocale));
    // "recent" already comes pre-sorted (newest first) from the store.
    return sorted;
  }, [books, query, formatFilter, sort, locale]);

  return (
    <div className="min-h-dvh w-full bg-[#fbfaf8] dark:bg-[#0a0a0a]">
      <header
        className="sticky top-0 z-10 border-b border-black/5 bg-[#fbfaf8]/80 backdrop-blur-md dark:border-white/5 dark:bg-[#0a0a0a]/80"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <LibraryBig className="size-4" strokeWidth={2} />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-reader-serif text-[15px] font-semibold text-foreground">
                {t("library.title")}
              </span>
              {loaded && (
                <span className="text-[11px] text-muted-foreground">
                  {t("library.bookCount", { count: books.length })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <AccountButton />
            <BackupMenu />
            <PwaStorageButton />
            {hasBooks && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("library.stats")}
                  onClick={() => setStatsOpen(true)}
                >
                  <BarChart3 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("library.addCategory")}
                  onClick={() => setCategoryOpen(true)}
                >
                  <Tag className="size-4" />
                </Button>
                <Button
                  variant={editMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditMode((v) => !v)}
                  className="gap-1.5"
                >
                  {editMode ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
                  {editMode ? t("library.doneEditing") : t("library.editLibrary")}
                </Button>
                <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                  <Plus className="size-3.5" />
                  {t("library.addBook")}
                </Button>
              </>
            )}
          </div>
        </div>

        {hasBooks && (
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5 px-5 pb-4 sm:px-8">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 sm:max-w-xs">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("library.searchPlaceholder")}
                className="h-full w-full bg-transparent text-sm outline-none"
              />
            </div>

            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger size="sm">
                <SelectValue>{SORT_LABELS[sort]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SORT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ToggleGroup
              value={[formatFilter]}
              onValueChange={(v) => {
                const next = v[0] as FormatFilter | undefined;
                if (next) setFormatFilter(next);
              }}
              variant="outline"
            >
              <ToggleGroupItem value="all">{t("format.all")}</ToggleGroupItem>
              <ToggleGroupItem value="epub">{t("format.epub")}</ToggleGroupItem>
              <ToggleGroupItem value="pdf">{t("format.pdf")}</ToggleGroupItem>
            </ToggleGroup>

            <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              <button
                type="button"
                aria-label={t("library.gridView")}
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  viewMode === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("library.listView")}
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  viewMode === "list"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("library.shelfView")}
                onClick={() => setViewMode("shelf")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  viewMode === "shelf"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Library className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {!loaded ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-muted" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-2/5 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : hasBooks ? (
          visibleBooks.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("library.noSearchResults")}
            </p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {visibleBooks.map((book, i) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
                >
                  <BookCard book={book} editMode={editMode} />
                </motion.div>
              ))}
            </div>
          ) : viewMode === "list" ? (
            <div className="flex flex-col gap-0.5">
              {visibleBooks.map((book, i) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 16) * 0.02, ease: [0.22, 1, 0.36, 1] }}
                >
                  <BookListRow book={book} editMode={editMode} />
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <ShelfView books={visibleBooks} />
            </motion.div>
          )
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-[60dvh] flex-col items-center justify-center"
          >
            <div className="w-full max-w-md">
              <div className="mb-8 text-center">
                <h1 className="font-reader-serif mb-1.5 text-2xl font-semibold text-foreground">
                  {t("library.emptyTitle")}
                </h1>
                <p className="text-sm text-muted-foreground">{t("library.emptySubtitle")}</p>
              </div>
              <UploadDropzone />
            </div>
          </motion.div>
        )}
      </main>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{t("library.uploadTitle")}</DialogTitle>
            <DialogDescription>{t("library.uploadDescription")}</DialogDescription>
          </DialogHeader>
          <UploadDropzone compact onImported={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>

      <ReadingStatsPanel open={statsOpen} onOpenChange={setStatsOpen} />
      <CategoryDialog open={categoryOpen} onOpenChange={setCategoryOpen} />
    </div>
  );
}
