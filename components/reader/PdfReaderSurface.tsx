"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { AnimatePresence, motion } from "framer-motion";
import { Columns, Minus, Plus, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { shouldRenderPdfPage } from "@/lib/reader-performance";
import type { PageTurnAnimationLevel } from "@/lib/types";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReaderProgressInfo, ReaderSurfaceHandle, SearchResult, SelectionPayload } from "./types";
import { PageCurlOverlay, PAGE_CURL_TOTAL_MS } from "./PageCurlOverlay";
import { useTranslation } from "@/lib/i18n/useTranslation";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;
const PDF_PAGE_PLACEHOLDER_HEIGHT = 842;

interface PdfReaderSurfaceProps {
  file: Blob;
  initialPage?: number;
  onProgress: (info: ReaderProgressInfo) => void;
  onError?: (error: unknown) => void;
  /** Fired on a plain tap/click (not a selection drag), with the horizontal zone it landed in. */
  onTap?: (zone: "prev" | "next" | "middle") => void;
  onSelection?: (payload: SelectionPayload) => void;
  pageTurnAnimation?: PageTurnAnimationLevel;
  /** Resolved reader background color, used to tint the "Gerçekçi" curl overlay. */
  pageBg?: string;
  /** Continuous-scroll vs page-by-page — mirrors the persisted reader setting. */
  scrollMode?: boolean;
  /** Fired when the in-reader toggle button changes scroll mode, so the caller can persist it. */
  onScrollModeChange?: (value: boolean) => void;
}

const TAP_MOVE_THRESHOLD = 6;
const SWIPE_FRACTION = 0.1;

export const PdfReaderSurface = forwardRef<ReaderSurfaceHandle, PdfReaderSurfaceProps>(
  function PdfReaderSurface(
    {
      file,
      initialPage = 1,
      onProgress,
      onError,
      onTap,
      onSelection,
      pageTurnAnimation,
      pageBg,
      scrollMode,
      onScrollModeChange,
    },
    ref
  ) {
    const { t } = useTranslation();
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(initialPage);
    // Which way the page number just moved, so the "Yumuşak" turn animation
    // tilts in from the edge it logically came from instead of always the
    // same way. Set alongside setPageNumber at every call site (not derived
    // from a ref during render — refs can't be read while rendering).
    const [direction, setDirection] = useState<1 | -1>(1);
    const [curl, setCurl] = useState<"next" | "prev" | null>(null);
    const curlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [scale, setScale] = useState(1);
    const pinchRef = useRef<{ active: boolean; lastDistance: number | null }>({
      active: false,
      lastDistance: null,
    });
    const [continuous, setContinuous] = useState(scrollMode ?? false);
    // Keeps this in sync if scrollMode is changed from the Settings panel
    // while the book is already open, not just via the toolbar button below.
    // Adjusted during render (React's documented pattern for "reset state
    // when a prop changes") rather than in an effect, so it takes effect in
    // the same commit instead of one render later.
    const [prevScrollMode, setPrevScrollMode] = useState(scrollMode);
    if (scrollMode !== prevScrollMode) {
      setPrevScrollMode(scrollMode);
      if (scrollMode !== undefined) setContinuous(scrollMode);
    }
    const scrollRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const pageObserverRef = useRef<IntersectionObserver | null>(null);
    const visiblePagesRef = useRef<ReadonlySet<number>>(new Set([initialPage]));
    const scrollFrameRef = useRef<number | null>(null);
    const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
    const [visiblePages, setVisiblePages] = useState<ReadonlySet<number>>(
      () => new Set([initialPage])
    );
    const supportsPageObservation = typeof IntersectionObserver !== "undefined";
    const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
    // react-pdf compares `file` by reference; memoize so the same Blob
    // doesn't trigger a full document reload on every parent re-render.
    const memoFile = useMemo(() => file, [file]);

    useEffect(() => {
      pdfDocumentRef.current = null;
    }, [memoFile]);

    const triggerCurl = (turnDirection: "next" | "prev") => {
      if (pageTurnAnimation !== 2) return;
      if (curlTimerRef.current) clearTimeout(curlTimerRef.current);
      setCurl(turnDirection);
      curlTimerRef.current = setTimeout(() => setCurl(null), PAGE_CURL_TOTAL_MS);
    };

    useEffect(() => {
      return () => {
        if (curlTimerRef.current) clearTimeout(curlTimerRef.current);
        if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
        pageObserverRef.current?.disconnect();
      };
    }, []);

    const scrollToPage = (page: number) => {
      pageRefs.current.get(page)?.scrollIntoView({ block: "start" });
    };

    const registerPageRef = (page: number) => (el: HTMLDivElement | null) => {
      const map = pageRefs.current;
      const previous = map.get(page);
      if (previous) pageObserverRef.current?.unobserve(previous);
      if (el) {
        el.dataset.page = String(page);
        map.set(page, el);
        pageObserverRef.current?.observe(el);
      } else {
        map.delete(page);
      }
    };

    useEffect(() => {
      if (!continuous || !numPages || !scrollRef.current) {
        pageObserverRef.current?.disconnect();
        pageObserverRef.current = null;
        return;
      }

      if (!supportsPageObservation) return;

      const observer = new IntersectionObserver(
        (entries) => {
          setVisiblePages((current) => {
            const next = new Set(current);
            for (const entry of entries) {
              const page = Number((entry.target as HTMLElement).dataset.page);
              if (!page) continue;
              if (entry.isIntersecting) next.add(page);
              else next.delete(page);
            }
            visiblePagesRef.current = next;
            return next;
          });
        },
        {
          root: scrollRef.current,
          // Render roughly one-and-a-half viewports before a page reaches
          // the screen, but release canvases once they are far away.
          rootMargin: "150% 0px",
        }
      );

      pageObserverRef.current = observer;
      pageRefs.current.forEach((el) => observer.observe(el));
      return () => {
        observer.disconnect();
        if (pageObserverRef.current === observer) pageObserverRef.current = null;
      };
    }, [continuous, numPages, supportsPageObservation]);

    useImperativeHandle(ref, () => ({
      next: () => {
        setDirection(1);
        triggerCurl("next");
        setPageNumber((p) => {
          const next = numPages ? Math.min(numPages, p + 1) : p;
          if (continuous) scrollToPage(next);
          return next;
        });
      },
      prev: () => {
        setDirection(-1);
        triggerCurl("prev");
        setPageNumber((p) => {
          const next = Math.max(1, p - 1);
          if (continuous) scrollToPage(next);
          return next;
        });
      },
      goToStart: () => {
        setDirection(-1);
        triggerCurl("prev");
        setPageNumber(1);
        if (continuous) scrollToPage(1);
      },
      goToEnd: () => {
        if (!numPages) return;
        setDirection(1);
        triggerCurl("next");
        setPageNumber(numPages);
        if (continuous) scrollToPage(numPages);
      },
      goToHref: () => {
        // No table of contents concept for raw PDFs.
      },
      goToLocation: (location: string) => {
        const page = Number(location.replace("page:", "")) || 1;
        const goingForward = page >= pageNumber;
        setDirection(goingForward ? 1 : -1);
        triggerCurl(goingForward ? "next" : "prev");
        setPageNumber(page);
        if (continuous) requestAnimationFrame(() => scrollToPage(page));
      },
      applyHighlight: () => {
        // No stable overlay target for raw PDF text yet — the highlight is
        // still saved (page + excerpt), just not painted on the page.
      },
      removeHighlight: () => {},
      search: async (query: string) => {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed) return [];
        const results: SearchResult[] = [];
        const existingDoc = pdfDocumentRef.current;
        const doc =
          existingDoc ??
          (await pdfjs.getDocument({ data: await memoFile.arrayBuffer() }).promise);
        try {
          for (let i = 1; i <= doc.numPages && results.length < 50; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const text = content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ");
            const lower = text.toLowerCase();
            let idx = lower.indexOf(trimmed);
            while (idx !== -1 && results.length < 50) {
              const start = Math.max(0, idx - 40);
              const end = Math.min(text.length, idx + trimmed.length + 40);
              const excerpt = `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
              results.push({ location: `page:${i}`, excerpt });
              idx = lower.indexOf(trimmed, idx + trimmed.length);
            }
          }
        } finally {
          if (!existingDoc) await doc.destroy();
        }
        return results;
      },
      getCurrentText: async () => {
        const existingDoc = pdfDocumentRef.current;
        const doc =
          existingDoc ??
          (await pdfjs.getDocument({ data: await memoFile.arrayBuffer() }).promise);
        try {
          const page = await doc.getPage(pageNumber);
          const content = await page.getTextContent();
          return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        } finally {
          if (!existingDoc) await doc.destroy();
        }
      },
    }));

    useEffect(() => {
      if (!numPages) return;
      onProgress({
        label: "",
        percentage: Math.round((pageNumber / numPages) * 100),
        location: `page:${pageNumber}`,
        page: pageNumber,
        totalPages: numPages,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageNumber, numPages]);

    // In continuous mode, track which page is closest to the top of the
    // scroll container so progress/page indicators stay accurate.
    const handleScroll = () => {
      if (!continuous || !scrollRef.current) return;
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        if (!scrollRef.current) return;
        const containerTop = scrollRef.current.getBoundingClientRect().top;
        let closest = pageNumber;
        let closestDistance = Infinity;
        for (const page of visiblePagesRef.current) {
          const el = pageRefs.current.get(page);
          if (!el) continue;
          const distance = Math.abs(el.getBoundingClientRect().top - containerTop);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = page;
          }
        }
        setPageNumber(closest);
      });
    };

    const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
    const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));

    const touchDistance = (touches: React.TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { active: true, lastDistance: touchDistance(e.touches) };
        // A second finger landing mid-gesture would otherwise also read as
        // a swipe/tap once lifted — see onPointerUp below.
        pointerDownPos.current = null;
      }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
      if (!pinchRef.current.active || e.touches.length !== 2) return;
      const distance = touchDistance(e.touches);
      const last = pinchRef.current.lastDistance;
      if (last) {
        const factor = distance / last;
        setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s * factor).toFixed(2))));
      }
      pinchRef.current.lastDistance = distance;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = { active: false, lastDistance: null };
    };

    const toggleContinuous = () => {
      setContinuous((c) => {
        const next = !c;
        if (next) requestAnimationFrame(() => scrollToPage(pageNumber));
        onScrollModeChange?.(next);
        return next;
      });
    };

    return (
      <div
        className="relative flex h-full w-full flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={(e) => {
          if (pinchRef.current.active) return;
          pointerDownPos.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (pinchRef.current.active) return;
          const start = pointerDownPos.current;
          pointerDownPos.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          const width = e.currentTarget.getBoundingClientRect().width || 1;

          // Swipe-only page turning — no more left/right tap zones. A plain
          // tap (below) always just toggles the chrome instead.
          if (Math.abs(dx) > width * SWIPE_FRACTION && Math.abs(dx) > Math.abs(dy)) {
            onTap?.(dx < 0 ? "next" : "prev");
            return;
          }

          const moved = Math.abs(dx) > TAP_MOVE_THRESHOLD || Math.abs(dy) > TAP_MOVE_THRESHOLD;
          if (!moved) {
            onTap?.("middle");
            return;
          }
          // Selection finalizes just after pointerup — read it on the next tick.
          setTimeout(() => {
            const sel = window.getSelection();
            const text = sel?.toString().trim();
            if (!text || !sel) return;
            let page = pageNumber;
            for (const [p, el] of pageRefs.current) {
              if (el.contains(sel.anchorNode)) {
                page = p;
                break;
              }
            }
            onSelection?.({ text, location: `page:${page}` });
          }, 0);
        }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            "flex h-full w-full flex-1 p-6",
            continuous
              ? "flex-col items-center gap-6 overflow-y-auto"
              : "items-center justify-center overflow-auto"
          )}
        >
          <Document
            file={memoFile}
            loading={null}
            onLoadError={(err) => onError?.(err)}
            onLoadSuccess={(doc) => {
              pdfDocumentRef.current = doc;
              setNumPages(doc.numPages);
              setPageNumber((p) => Math.min(Math.max(1, p), doc.numPages));
            }}
          >
            {continuous
              ? numPages > 0 &&
                Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
                  <div
                    key={page}
                    ref={registerPageRef(page)}
                    data-pdf-page-slot={page}
                    className="flex w-full justify-center"
                    style={{ minHeight: Math.round(PDF_PAGE_PLACEHOLDER_HEIGHT * scale) }}
                  >
                    {(!supportsPageObservation ||
                      shouldRenderPdfPage(page, pageNumber, visiblePages)) && (
                      <Page
                        pageNumber={page}
                        scale={scale}
                        renderAnnotationLayer={false}
                        renderTextLayer
                        className="shadow-xl"
                      />
                    )}
                  </div>
                ))
              : pageTurnAnimation === 2
                ? (
                    // "Gerçekçi" — a multi-strip curl overlay (rendered
                    // below, outside the Document) plays over this plain,
                    // instantly-swapped page. A rotateY-based flip here
                    // would double up with the overlay's own 3D motion.
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      renderAnnotationLayer={false}
                      renderTextLayer
                      className="shadow-xl"
                    />
                  )
                : pageTurnAnimation === 1
                  ? (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={pageNumber}
                          initial={{
                            opacity: 0,
                            x: 26 * direction,
                            rotateY: -6 * direction,
                            transformPerspective: 1400,
                          }}
                          animate={{ opacity: 1, x: 0, rotateY: 0, transformPerspective: 1400 }}
                          exit={{
                            opacity: 0,
                            x: -26 * direction,
                            rotateY: 6 * direction,
                            transformPerspective: 1400,
                          }}
                          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderAnnotationLayer={false}
                            renderTextLayer
                            className="shadow-xl"
                          />
                        </motion.div>
                      </AnimatePresence>
                    )
                  : (
                      <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderAnnotationLayer={false}
                        renderTextLayer
                        className="shadow-xl"
                      />
                    )}
          </Document>
        </div>

        {curl && <PageCurlOverlay direction={curl} bg={pageBg ?? "#ffffff"} />}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
          <div
            className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/5 bg-popover/90 px-1.5 py-1 shadow-lg ring-1 ring-foreground/5 backdrop-blur-xl dark:border-white/5"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <ControlButton label={t("pdf.zoomOut")} onClick={zoomOut} disabled={scale <= MIN_SCALE}>
              <Minus className="size-3.5" />
            </ControlButton>
            <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <ControlButton label={t("pdf.zoomIn")} onClick={zoomIn} disabled={scale >= MAX_SCALE}>
              <Plus className="size-3.5" />
            </ControlButton>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <ControlButton
              label={continuous ? t("pdf.pageMode") : t("pdf.scrollMode")}
              onClick={toggleContinuous}
              active={continuous}
            >
              {continuous ? <Columns className="size-3.5" /> : <ScrollText className="size-3.5" />}
            </ControlButton>
          </div>
        </div>
      </div>
    );
  }
);

function ControlButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-foreground transition-colors disabled:pointer-events-none disabled:opacity-30",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
