"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SearchResult } from "./types";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function SearchPanel({
  open,
  onOpenChange,
  onSearch,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onNavigate: (location: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const r = await onSearch(q);
      setResults(r);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setQuery("");
          setResults([]);
          setSearched(false);
        }
      }}
    >
      <SheetContent
        side="left"
        className="gap-0 border-none bg-popover/95 px-0 pb-6 pt-3 shadow-2xl backdrop-blur-xl"
      >
        <SheetHeader className="px-5 pb-3">
          <SheetTitle className="text-[15px]">{t("search.title")}</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => void runSearch(e.target.value)}
              placeholder={t("search.placeholder")}
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
            {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto px-2">
          {searched && !loading && results.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              {t("search.noResults")}
            </p>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.location}-${i}`}
              type="button"
              onClick={() => {
                onNavigate(r.location);
                onOpenChange(false);
              }}
              className="rounded-xl px-3 py-2.5 text-left text-[13px] leading-snug text-foreground hover:bg-muted"
            >
              {r.excerpt}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
