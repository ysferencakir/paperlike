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
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { toast } from "@/store/useToastStore";
import { useBackHandlerStore } from "@/store/useBackHandlerStore";
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
import {
  syncStatusBar,
  setImmersive,
  setKeepAwake,
  hapticPageTurn,
  hapticAction,
  enableVolumeKeyPageTurn,
  speak,
  stopSpeaking,
  scheduleBreakReminder,
  cancelBreakReminder,
  setContinueReadingShortcut,
  updateContinueReadingWidget,
} from "@/lib/native-ui";
import { cn, generateId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import { EpubReaderSurface } from "./EpubReaderSurface";
import { TocPanel } from "./TocPanel";
import { SelectionBar } from "./SelectionBar";
import { NotesPanel } from "./NotesPanel";
import { SearchPanel } from "./SearchPanel";
import { BookOpenTransition } from "./BookOpenTransition";
import { ReaderOnboarding } from "./ReaderOnboarding";
import { PageThicknessIndicator } from "./PageThicknessIndicator";
import { BreakSuggestion } from "./BreakSuggestion";
import type {
  ReaderProgressInfo,
  ReaderSurfaceHandle,
  SearchResult,
  SelectionPayload,
  TocEntry,
} from "./types";
import { useTranslation } from "@/lib/i18n/useTranslation";

// Screens at least this wide get a two-page spread automatically (unless the
// user has manually touched the column toggle — see columnsAutoManaged).
const TABLET_SPREAD_MIN_WIDTH = 900;

// react-pdf touches browser-only pdf.js internals at module-evaluation time
// (see lib/pdf-loader.ts) — load it client-only to avoid an SSR crash.
const PdfReaderSurface = dynamic(
  () => import("./PdfReaderSurface").then((m) => m.PdfReaderSurface),
  { ssr: false }
);

export function ReaderView({ bookId }: { bookId: string }) {
  const { t, locale } = useTranslation();
  const settings = useSettingsStore();
  const { breakRemindersEnabled, breakIntervalMinutes } = useReadingGoalStore();
  const seenReaderTutorial = useOnboardingStore((s) => s.seenReaderTutorial);
  const markReaderTutorialSeen = useOnboardingStore((s) => s.markReaderTutorialSeen);
  const theme = resolveTheme(settings);
  const colors = resolveColors(settings);
  const [isTabletWidth, setIsTabletWidth] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${TABLET_SPREAD_MIN_WIDTH}px)`);
    const apply = () => setIsTabletWidth(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const effectiveColumns: 1 | 2 = settings.columnsAutoManaged
    ? isTabletWidth
      ? 2
      : 1
    : settings.columns;
  const epubSettings =
    effectiveColumns === settings.columns ? settings : { ...settings, columns: effectiveColumns };
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
    return () => void stopSpeaking();
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

    const flush = () => {
      tick();
      if (accumulatedMs >= 1000) {
        void addReadingMinutes(accumulatedMs / 60000);
        accumulatedMs = 0;
      }
    };

    const flushTimer = setInterval(flush, FLUSH_MS);
    // Backgrounding the app (task switcher, screen lock, ...) can lead to the
    // process being killed outright before the next interval tick — flush
    // immediately instead of risking up to FLUSH_MS of reading time with it.
    document.addEventListener("visibilitychange", flush);

    return () => {
      clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", flush);
      tick();
      if (accumulatedMs > 0) void addReadingMinutes(accumulatedMs / 60000);
    };
  }, [bookId]);

  // A single, easy-to-dismiss nudge partway through a long sitting — never
  // repeats within the same session, never guilt-trips if ignored. Also
  // schedules a native notification for the same moment, since a plain JS
  // timer never fires if the app gets backgrounded or killed before then —
  // cancelled below once the in-app nudge actually shows, so it doesn't
  // *also* pop as a redundant notification a few seconds later.
  useEffect(() => {
    if (!breakRemindersEnabled) return;
    const timer = setTimeout(() => setBreakSuggested(true), breakIntervalMinutes * 60000);
    void scheduleBreakReminder(breakIntervalMinutes, t);
    return () => {
      clearTimeout(timer);
      void cancelBreakReminder();
    };
  }, [bookId, breakRemindersEnabled, breakIntervalMinutes, t]);

  useEffect(() => {
    if (!breakSuggested) return;
    void cancelBreakReminder();
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
    // chromeVisible already starts true — this just arms the auto-hide
    // timer for the initial mount, same as resetIdleTimer does, without
    // redundantly calling setChromeVisible(true) synchronously in the effect.
    idleTimer.current = setTimeout(() => setChromeVisible(false), 3200);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const stopTts = () => {
    void stopSpeaking();
    setTtsPlaying(false);
  };

  const goNext = () => {
    surfaceRef.current?.next();
    void hapticPageTurn();
    if (ttsPlaying) stopTts();
  };
  const goPrev = () => {
    surfaceRef.current?.prev();
    void hapticPageTurn();
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

  // Same close-topmost-panel priority as Escape above, but for the Android
  // back button/gesture (see BackButtonHandler). Returning false here — no
  // panel was open — lets that handler's own fallback take over and
  // navigate back to the library, exactly like the "Kütüphaneye dön" link.
  useEffect(() => {
    const backHandler = () => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (tocOpen) {
        setTocOpen(false);
        return true;
      }
      if (notesOpen) {
        setNotesOpen(false);
        return true;
      }
      if (searchOpen) {
        setSearchOpen(false);
        return true;
      }
      if (pendingSelection) {
        setPendingSelection(null);
        return true;
      }
      return false;
    };
    useBackHandlerStore.getState().setHandler(backHandler);
    return () => useBackHandlerStore.getState().clearHandler(backHandler);
  }, [settingsOpen, tocOpen, notesOpen, searchOpen, pendingSelection]);

  // Keeps the app icon's "Continue reading" shortcut pointed at whichever
  // book was opened most recently.
  useEffect(() => {
    if (book) void setContinueReadingShortcut(bookId, book.title, t);
  }, [bookId, book, t]);

  // Keeps the home-screen "continue reading" widget in sync with the book
  // and page currently being read.
  useEffect(() => {
    if (book) void updateContinueReadingWidget(bookId, book.title, progress.percentage);
  }, [bookId, book, progress.percentage]);

  // Tint the status bar to match whatever the reader itself is showing —
  // otherwise it stays whatever color the library screen last set it to.
  useEffect(() => {
    void syncStatusBar(colors.bg);
  }, [colors.bg]);

  // Hides the system nav bar for the whole reading session (not tied to
  // chromeVisible toggling) — hiding/showing it resizes the WebView's
  // visible viewport, which makes epub.js reflow/repaginate and visibly
  // "jump". Restore on unmount so leaving the reader doesn't leave the app
  // stuck immersive.
  useEffect(() => {
    void setImmersive(true);
    return () => void setImmersive(false);
  }, []);

  // Don't let the screen dim/lock while a book is open — same as every
  // other e-reader. Restored on unmount regardless of TTS/idle state.
  useEffect(() => {
    void setKeepAwake(true);
    return () => void setKeepAwake(false);
  }, []);

  // Opt-in: turn pages with the hardware volume buttons. goNext/goPrev are
  // read through a ref so this effect only has to re-run (re-registering
  // the native listener) when the setting itself changes, not on every render.
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  useEffect(() => {
    goNextRef.current = goNext;
    goPrevRef.current = goPrev;
  });
  useEffect(() => {
    if (!settings.volumeKeyPageTurn) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void enableVolumeKeyPageTurn((direction) => {
      if (direction === "down") goNextRef.current();
      else goPrevRef.current();
    }).then((c) => {
      if (cancelled) c();
      else cleanup = c;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [settings.volumeKeyPageTurn]);

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
    setSurfaceError(t("reader.openError"));
  };

  const toggleTts = async () => {
    if (ttsPlaying) {
      stopTts();
      return;
    }
    const text = await surfaceRef.current?.getCurrentText();
    if (!text?.trim()) {
      toast.error(t("reader.noTextOnPage"));
      return;
    }
    setTtsPlaying(true);
    void speak(text, locale === "tr" ? "tr-TR" : "en-US", () => setTtsPlaying(false));
  };

  const handleConfirmHighlight = async (color: string, importance: ImportanceLevel) => {
    if (!pendingSelection) return;
    const highlight: Highlight = {
      id: generateId(),
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
    void hapticAction();
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
      void hapticAction();
      return;
    }
    const bookmark: Bookmark = {
      id: generateId(),
      bookId,
      location: progress.location,
      label:
        progress.label ||
        (progress.page
          ? t("reader.pageLabel", { page: progress.page })
          : book?.title ?? t("reader.locationFallback")),
      createdAt: Date.now(),
    };
    await addBookmark(bookmark);
    setBookmarks((prev) => [...prev, bookmark]);
    void hapticAction();
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
        <p className="text-sm text-muted-foreground">{t("reader.bookNotFound")}</p>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/" />}>
          {t("reader.backToLibrary")}
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
      onMouseMove={(e) => {
        // Touch devices fire a synthetic, zero-delta "mousemove" right after
        // every tap for compatibility with mouse-only listeners — without
        // this check, that reopens the chrome the instant a tap closes it.
        if (e.movementX === 0 && e.movementY === 0) return;
        resetIdleTimer();
      }}
    >
      {!introDone && <BookOpenTransition book={book} onDone={() => setIntroDone(true)} />}

      <AnimatePresence>
        {introDone && !seenReaderTutorial && (
          <ReaderOnboarding onDismiss={markReaderTutorialSeen} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chromeVisible && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pb-6 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6"
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
              aria-label={t("reader.backToLibrary")}
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
                aria-label={ttsPlaying ? t("reader.stopReadAloud") : t("reader.readAloud")}
                onClick={() => void toggleTts()}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                {ttsPlaying ? <Pause className="size-4" /> : <Volume2 className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("reader.searchInBook")}
                onClick={() => setSearchOpen(true)}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                <Search className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("reader.notes")}
                onClick={() => setNotesOpen(true)}
                className="hover:bg-[color-mix(in_oklch,var(--reader-fg),transparent_92%)]"
                style={{ color: "var(--reader-fg)" }}
              >
                <StickyNote className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={isBookmarked ? t("reader.removeBookmark") : t("reader.addBookmark")}
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
                  aria-label={t("reader.toc")}
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
                aria-label={t("reader.settings")}
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
                {t("reader.backToLibrary")}
              </Button>
            </div>
          ) : book.format === "epub" ? (
            <EpubReaderSurface
              ref={surfaceRef}
              file={file}
              settings={epubSettings}
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
              scrollMode={settings.scrollMode}
              onScrollModeChange={(value) => settings.update({ scrollMode: value })}
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
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 backdrop-blur-md sm:px-8"
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
