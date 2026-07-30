"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SearchOptions, SearchProgress, SearchResult } from "./types";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { isSearchAbortError } from "@/lib/search-control";

const SEARCH_DEBOUNCE_MS = 250;

export function SearchPanel({
  open,
  onOpenChange,
  onSearch,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSearch: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  onNavigate: (location: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [failed, setFailed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const cancelSearch = () => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  useEffect(() => {
    if (open) return;
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, [open]);

  const resetSearch = () => {
    cancelSearch();
    setQuery("");
    setResults([]);
    setLoading(false);
    setSearched(false);
    setProgress(null);
    setFailed(false);
  };

  const runSearch = (q: string) => {
    setQuery(q);
    cancelSearch();
    setFailed(false);
    setProgress(null);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }

    const requestId = requestIdRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setSearched(false);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void onSearch(q, {
        signal: controller.signal,
        onProgress: (nextProgress) => {
          if (requestIdRef.current === requestId && !controller.signal.aborted) {
            setProgress(nextProgress);
          }
        },
      })
        .then((nextResults) => {
          if (requestIdRef.current !== requestId || controller.signal.aborted) return;
          setResults(nextResults);
          setSearched(true);
        })
        .catch((error: unknown) => {
          if (
            requestIdRef.current !== requestId ||
            controller.signal.aborted ||
            isSearchAbortError(error)
          ) {
            return;
          }
          setResults([]);
          setSearched(true);
          setFailed(true);
        })
        .finally(() => {
          if (requestIdRef.current !== requestId) return;
          controllerRef.current = null;
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetSearch();
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

        {loading && progress && (
          <div className="px-5 pb-3" role="status" aria-live="polite">
            <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>
                {t("search.progress", {
                  completed: progress.completed,
                  total: progress.total,
                  count: progress.resultCount,
                })}
              </span>
              <span>
                {progress.total
                  ? `${Math.round((progress.completed / progress.total) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{
                  width: `${
                    progress.total
                      ? Math.min(100, (progress.completed / progress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 overflow-y-auto px-2">
          {failed && (
            <p className="px-3 py-6 text-center text-[13px] text-destructive" role="alert">
              {t("search.failed")}
            </p>
          )}
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
                resetSearch();
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
