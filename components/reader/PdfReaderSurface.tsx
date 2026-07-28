"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { AnimatePresence, motion } from "framer-motion";
import { Columns, Minus, Plus, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageTurnAnimationLevel } from "@/lib/types";
import type { ReaderProgressInfo, ReaderSurfaceHandle, SearchResult, SelectionPayload } from "./types";
import { PageCurlOverlay, PAGE_CURL_TOTAL_MS } from "./PageCurlOverlay";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;

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
}

const TAP_MOVE_THRESHOLD = 6;

export const PdfReaderSurface = forwardRef<ReaderSurfaceHandle, PdfReaderSurfaceProps>(
  function PdfReaderSurface(
    { file, initialPage = 1, onProgress, onError, onTap, onSelection, pageTurnAnimation, pageBg },
    ref
  ) {
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
    const [continuous, setContinuous] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
    // react-pdf compares `file` by reference; memoize so the same Blob
    // doesn't trigger a full document reload on every parent re-render.
    const memoFile = useMemo(() => file, [file]);

    const triggerCurl = (turnDirection: "next" | "prev") => {
      if (pageTurnAnimation !== 2) return;
      if (curlTimerRef.current) clearTimeout(curlTimerRef.current);
      setCurl(turnDirection);
      curlTimerRef.current = setTimeout(() => setCurl(null), PAGE_CURL_TOTAL_MS);
    };

    useEffect(() => {
      return () => {
        if (curlTimerRef.current) clearTimeout(curlTimerRef.current);
      };
    }, []);

    const scrollToPage = (page: number) => {
      pageRefs.current.get(page)?.scrollIntoView({ block: "start" });
    };

    const registerPageRef = (page: number) => (el: HTMLDivElement | null) => {
      const map = pageRefs.current;
      if (el) map.set(page, el);
      else map.delete(page);
    };

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
        const doc = await pdfjs.getDocument({ data: await memoFile.arrayBuffer() }).promise;
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
        await doc.destroy();
        return results;
      },
      getCurrentText: async () => {
        const doc = await pdfjs.getDocument({ data: await memoFile.arrayBuffer() }).promise;
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        await doc.destroy();
        return text;
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
      const containerTop = scrollRef.current.getBoundingClientRect().top;
      let closest = pageNumber;
      let closestDistance = Infinity;
      for (const [page, el] of pageRefs.current) {
        const distance = Math.abs(el.getBoundingClientRect().top - containerTop);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = page;
        }
      }
      setPageNumber(closest);
    };

    const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
    const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));

    const toggleContinuous = () => {
      setContinuous((c) => {
        const next = !c;
        if (next) requestAnimationFrame(() => scrollToPage(pageNumber));
        return next;
      });
    };

    return (
      <div
        className="relative flex h-full w-full flex-col"
        onPointerDown={(e) => {
          pointerDownPos.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = pointerDownPos.current;
          pointerDownPos.current = null;
          if (!start) return;
          const moved =
            Math.abs(e.clientX - start.x) > TAP_MOVE_THRESHOLD ||
            Math.abs(e.clientY - start.y) > TAP_MOVE_THRESHOLD;
          if (!moved) {
            const width = e.currentTarget.getBoundingClientRect().width || 1;
            const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
            if (x < width * 0.28) onTap?.("prev");
            else if (x > width * 0.72) onTap?.("next");
            else onTap?.("middle");
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
              setNumPages(doc.numPages);
              setPageNumber((p) => Math.min(Math.max(1, p), doc.numPages));
            }}
          >
            {continuous
              ? numPages > 0 &&
                Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
                  <div key={page} ref={registerPageRef(page)}>
                    <Page
                      pageNumber={page}
                      scale={scale}
                      renderAnnotationLayer={false}
                      renderTextLayer
                      className="shadow-xl"
                    />
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
            <ControlButton label="Uzaklaştır" onClick={zoomOut} disabled={scale <= MIN_SCALE}>
              <Minus className="size-3.5" />
            </ControlButton>
            <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <ControlButton label="Yakınlaştır" onClick={zoomIn} disabled={scale >= MAX_SCALE}>
              <Plus className="size-3.5" />
            </ControlButton>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <ControlButton
              label={continuous ? "Sayfa modu" : "Kaydırma modu"}
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
