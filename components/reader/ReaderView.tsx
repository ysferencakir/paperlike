"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark as BookmarkIcon,
  List,
  Loader2,
  Pause,
  Search,
  Settings2,
  StickyNote,
  Volume2,
} from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useReadingGoalStore } from "@/store/useReadingGoalStore";
import { toast } from "@/store/useToastStore";
import {
  addBookmark,
  addHighlight,
  addReadingMinutes,
  deleteBookmark,
  deleteHighlight,
  getBook,
  getBookFile,
  getBookmarks,
  getHighlights,
  getProgress,
  setProgress,
  updateHighlight,
} from "@/lib/storage";
import type { Book, Bookmark, Highlight, ImportanceLevel } from "@/lib/types";
import { resolveColors, resolveTheme } from "@/lib/reader-theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import { EpubReaderSurface } from "./EpubReaderSurface";
import { TocPanel } from "./TocPanel";
import { SelectionBar } from "./SelectionBar";
import { NotesPanel } from "./NotesPanel";
import { SearchPanel } from "./SearchPanel";
import { BookOpenTransition } from "./BookOpenTransition";
import { PageThicknessIndicator } from "./PageThicknessIndicator";
import { BreakSuggestion } from "./BreakSuggestion";
import type {
  ReaderProgressInfo,
  ReaderSurfaceHandle,
  SearchResult,
  SelectionPayload,
  TocEntry,
} from "./types";

// react-pdf touches browser-only pdf.js internals at module-evaluation time
// (see lib/pdf-loader.ts) — load it client-only to avoid an SSR crash.
const PdfReaderSurface = dynamic(
  () => import("./PdfReaderSurface").then((m) => m.PdfReaderSurface),
  { ssr: false }
);

export function ReaderView({ bookId }: { bookId: string }) {
  const settings = useSettingsStore();
  const { breakRemindersEnabled, breakIntervalMinutes } = useReadingGoalStore();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [pendingSelection, setPendingSelection] = useState<SelectionPayload | null>(null);
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [file, setFile] = useState<Blob | null>(null);
  const [initialLocation, setInitialLocation] = useState<string | undefined>();
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [breakSuggested, setBreakSuggested] = useState(false);
  const [progress, setProgressInfo] = useState<ReaderProgressInfo>({
    label: "",
    percentage: 0,
    location: "",
  });

  const surfaceRef = useRef<ReaderSurfaceHandle>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setToc([]);
      setPendingSelection(null);
      setIntroDone(false);
      const [b, f, p, h, bm] = await Promise.all([
        getBook(bookId),
        getBookFile(bookId),
        getProgress(bookId),
        getHighlights(bookId),
        getBookmarks(bookId),
      ]);
      if (cancelled) return;
      setBook(b ?? null);
      setFile(f ?? null);
      setHighlights(h);
      setBookmarks(bm);
      if (p?.location) setInitialLocation(p.location);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // Stop any in-progress read-aloud when leaving this book (route change or unmount).
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [bookId]);

  // Quietly counts time spent actually looking at this book, flushed
  // periodically so a crash or hard-close doesn't lose the session. Only
  // used for the gentle stats/streak view — never surfaced as pressure.
  useEffect(() => {
    let accumulatedMs = 0;
    let lastTick = Date.now();
    const FLUSH_MS = 30000;

    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") accumulatedMs += now - lastTick;
      lastTick = now;
    };

    const flushTimer = setInterval(() => {
      tick();
      if (accumulatedMs >= 1000) {
        void addReadingMinutes(accumulatedMs / 60000);
        accumulatedMs = 0;
      }
    }, FLUSH_MS);

    return () => {
      clearInterval(flushTimer);
      tick();
      if (accumulatedMs > 0) void addReadingMinutes(accumulatedMs / 60000);
    };
  }, [bookId]);

  // A single, easy-to-dismiss nudge partway through a long sitting — never
  // repeats within the same session, never guilt-trips if ignored.
  useEffect(() => {
    if (!breakRemindersEnabled) return;
    const timer = setTimeout(() => setBreakSuggested(true), breakIntervalMinutes * 60000);
    return () => clearTimeout(timer);
  }, [bookId, breakRemindersEnabled, breakIntervalMinutes]);

  useEffect(() => {
    if (!breakSuggested) return;
    const timer = setTimeout(() => setBreakSuggested(false), 12000);
    return () => clearTimeout(timer);
  }, [breakSuggested]);

  const resetIdleTimer = () => {
    setChromeVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setChromeVisible(false), 3200);
  };

  const toggleChrome = () => {
    if (chromeVisible) {
      setChromeVisible(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    } else {
      resetIdleTimer();
    }
  };

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTts = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setTtsPlaying(false);
  };

  const goNext = () => {
    surfaceRef.current?.next();
    resetIdleTimer();
    if (ttsPlaying) stopTts();
  };
  const goPrev = () => {
    surfaceRef.current?.prev();
    resetIdleTimer();
    if (ttsPlaying) stopTts();
  };

  const handleTap = (zone: "prev" | "next" | "middle") => {
    if (zone === "prev") goPrev();
    else if (zone === "next") goNext();
    else toggleChrome();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false);
        else if (tocOpen) setTocOpen(false);
        else if (notesOpen) setNotesOpen(false);
        else if (searchOpen) setSearchOpen(false);
        else if (pendingSelection) setPendingSelection(null);
        return;
      }
      // Don't hijack shortcuts while a panel is open or focus is on an input.
      if (settingsOpen || tocOpen || notesOpen || searchOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      switch (e.key) {
        case "ArrowRight":
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case " ":
          e.preventDefault();
          if (e.shiftKey) goPrev();
          else goNext();
          break;
        case "Home":
          e.preventDefault();
          surfaceRef.current?.goToStart();
          resetIdleTimer();
          break;
        case "End":
          e.preventDefault();
          surfaceRef.current?.goToEnd();
          resetIdleTimer();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, tocOpen, notesOpen, searchOpen, pendingSelection]);

  const handleProgress = (info: ReaderProgressInfo) => {
    setProgressInfo(info);
    if (!info.location) return;
    void setProgress({
      bookId,
      location: info.location,
      percentage: info.percentage,
      updatedAt: Date.now(),
    });
  };

  const handleSurfaceError = (err: unknown) => {
    console.error("Reader surface error:", err);
    setSurfaceError(
      "Bu kitap açılamadı — dosya bozuk ya da desteklenmeyen bir yapıda olabilir."
    );
  };

  const toggleTts = async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Tarayıcın sesli okumayı desteklemiyor.");
      return;
    }
    if (ttsPlaying) {
      stopTts();
      return;
    }
    const text = await surfaceRef.current?.getCurrentText();
    if (!text?.trim()) {
      toast.error("Bu sayfada okunacak metin bulunamadı.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    utterance.onend = () => setTtsPlaying(false);
    utterance.onerror = () => setTtsPlaying(false);
    window.speechSynthesis.speak(utterance);
    setTtsPlaying(true);
  };

  const handleConfirmHighlight = async (color: string, importance: ImportanceLevel) => {
    if (!pendingSelection) return;
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      bookId,
      location: pendingSelection.location,
      text: pendingSelection.text,
      color,
      importance,
      createdAt: Date.now(),
    };
    await addHighlight(highlight);
    setHighlights((prev) => [...prev, highlight]);
    surfaceRef.current?.applyHighlight(highlight.location, color);
    setPendingSelection(null);
  };

  const handleDeleteHighlight = async (id: string) => {
    const target = highlights.find((h) => h.id === id);
    await deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    if (target) surfaceRef.current?.removeHighlight(target.location);
  };

  const handleUpdateNote = async (id: string, note: string) => {
    await updateHighlight(id, { note });
    setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, note } : h)));
  };

  const handleUpdateImportance = async (id: string, importance: ImportanceLevel) => {
    await updateHighlight(id, { importance });
    setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, importance } : h)));
  };

  const isBookmarked = bookmarks.some((b) => b.location === progress.location);

  const toggleBookmark = async () => {
    if (!progress.location) return;
    const existing = bookmarks.find((b) => b.location === progress.location);
    if (existing) {
      await deleteBookmark(existing.id);
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
      return;
    }
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      bookId,
      location: progress.location,
      label:
        progress.label ||
        (progress.page ? `Sayfa ${progress.page}` : book?.title ?? "Konum"),
      createdAt: Date.now(),
    };
    await addBookmark(bookmark);
    setBookmarks((prev) => [...prev, bookmark]);
  };

  const handleDeleteBookmark = async (id: string) => {
    await deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSearch = (query: string): Promise<SearchResult[]> =>
    surfaceRef.current?.search(query) ?? Promise.resolve([]);

  const goToLocation = (location: string) => surfaceRef.current?.goToLocation(location);

  if (book === null) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-background text-center">
        <p className="text-sm text-muted-foreground">Bu kitap bulunamadı.</p>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/" />}>
          Kütüphaneye dön
        </Button>
      </div>
    );
  }

  if (book === undefined || !file) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const theme = resolveTheme(settings);
  const colors = resolveColors(settings);
  const themeStyle =
    theme === "custom"
      ? ({
          backgroundColor: settings.customBg,
          "--reader-bg": settings.customBg,
          "--reader-fg": settings.customFg,
        } as React.CSSProperties)
      : { backgroundColor: "var(--reader-bg)" };

  return (
    <div
      className={cn(
        "relative flex h-dvh w-full flex-col overflow-hidden",
        theme !== "custom" && `reader-theme-${theme}`
      )}
      style={themeStyle}
      onMouseMove={resetIdleTimer}
    >
      {!introDone && <BookOpenTransition book={book} onDone={() => setIntroDone(true)} />}

      <AnimatePresence>
        {chromeVisible && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pb-6 pt-4 backdrop-blur-md sm:px-6"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in oklch, var(--reader-bg), transparent 8%), transparent)",
            }}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href="/" />}
              className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
              style={{ color: "var(--reader-fg)" }}
            >
              <ArrowLeft className="size-4" />
            </Button>

            <span
              className="max-w-[60%] truncate text-[13px] font-medium tracking-wide opacity-60"
              style={{ color: "var(--reader-fg)" }}
            >
              {progress.label || book.title}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={ttsPlaying ? "Sesli okumayı durdur" : "Sesli oku"}
                onClick={() => void toggleTts()}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                {ttsPlaying ? <Pause className="size-4" /> : <Volume2 className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Kitapta ara"
                onClick={() => setSearchOpen(true)}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                <Search className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notlarım"
                onClick={() => setNotesOpen(true)}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                <StickyNote className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={isBookmarked ? "Yer imini kaldır" : "Yer imi ekle"}
                onClick={() => void toggleBookmark()}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                <BookmarkIcon className={cn("size-4", isBookmarked && "fill-current")} />
              </Button>
              {book.format === "epub" && toc.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="İçindekiler"
                  onClick={() => setTocOpen(true)}
                  className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                  style={{ color: "var(--reader-fg)" }}
                >
                  <List className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ayarlar"
                onClick={() => setSettingsOpen(true)}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                <Settings2 className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex-1 overflow-hidden">
        <div
          className="h-full w-full"
          style={{
            // The filter must paint the page background too, not just the
            // (transparent) reading surface on top of it — otherwise
            // brightness/contrast/warmth only ever touch text pixels and
            // are nearly invisible. Background lives on the root wrapper,
            // so it has to be repeated here, inside the filtered element.
            backgroundColor: "var(--reader-bg)",
            filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%) sepia(${settings.warmth / 100})`,
          }}
        >
          {surfaceError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center">
              <AlertTriangle className="size-6 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">{surfaceError}</p>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/" />}>
                Kütüphaneye dön
              </Button>
            </div>
          ) : book.format === "epub" ? (
            <EpubReaderSurface
              ref={surfaceRef}
              file={file}
              settings={settings}
              colors={colors}
              initialLocation={initialLocation}
              onProgress={handleProgress}
              onError={handleSurfaceError}
              onToc={setToc}
              onSelection={setPendingSelection}
              highlights={highlights}
              onTap={handleTap}
            />
          ) : (
            <PdfReaderSurface
              ref={surfaceRef}
              file={file}
              initialPage={initialLocation ? Number(initialLocation.replace("page:", "")) || 1 : 1}
              onProgress={handleProgress}
              onError={handleSurfaceError}
              onTap={handleTap}
              onSelection={setPendingSelection}
              pageTurnAnimation={settings.pageTurnAnimation}
              pageBg={colors.bg}
            />
          )}
        </div>

        <AnimatePresence>
          {pendingSelection && (
            <SelectionBar
              selection={pendingSelection}
              onConfirm={(color, importance) => void handleConfirmHighlight(color, importance)}
              onDismiss={() => setPendingSelection(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {breakSuggested && (
            <BreakSuggestion onDismiss={() => setBreakSuggested(false)} />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {chromeVisible && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-5 pb-5 pt-8 backdrop-blur-md sm:px-8"
            style={{
              background:
                "linear-gradient(to top, color-mix(in oklch, var(--reader-bg), transparent 8%), transparent)",
            }}
          >
            <div
              className="flex items-center justify-between text-[11px] tabular-nums opacity-50"
              style={{ color: "var(--reader-fg)" }}
            >
              <span>{progress.page && progress.totalPages ? `${progress.page} / ${progress.totalPages}` : " "}</span>
              <PageThicknessIndicator percentage={progress.percentage} />
              <span>%{progress.percentage}</span>
            </div>
            <div
              className="h-[3px] w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "color-mix(in oklch, var(--reader-fg), transparent 88%)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress.percentage}%`,
                  backgroundColor: "color-mix(in oklch, var(--reader-fg), transparent 35%)",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReaderSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      {book.format === "epub" && (
        <TocPanel
          open={tocOpen}
          onOpenChange={setTocOpen}
          toc={toc}
          onNavigate={(href) => surfaceRef.current?.goToHref(href)}
        />
      )}
      <NotesPanel
        open={notesOpen}
        onOpenChange={setNotesOpen}
        book={book}
        highlights={highlights}
        bookmarks={bookmarks}
        onNavigate={(location) => {
          goToLocation(location);
          setNotesOpen(false);
        }}
        onDeleteHighlight={(id) => void handleDeleteHighlight(id)}
        onUpdateNote={(id, note) => void handleUpdateNote(id, note)}
        onUpdateImportance={(id, importance) => void handleUpdateImportance(id, importance)}
        onDeleteBookmark={(id) => void handleDeleteBookmark(id)}
      />
      <SearchPanel
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSearch={handleSearch}
        onNavigate={goToLocation}
      />
    </div>
  );
}
