"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ePub from "epubjs";
import type { Book as EpubBook, Contents, Location as EpubLocation, Rendition } from "epubjs";
import type { ReaderSettings } from "@/lib/types";
import { getEpubLocationBreak } from "@/lib/reader-performance";
import { searchEpubSections, type EpubSearchSection } from "@/lib/epub-search";
import type { ReaderProgressInfo, ReaderSurfaceHandle, SelectionPayload, TocEntry } from "./types";
import { PageCurlOverlay, PAGE_CURL_TOTAL_MS } from "./PageCurlOverlay";
import { useTranslation } from "@/lib/i18n/useTranslation";

function toTocEntries(items: { href: string; label: string; subitems?: unknown[] }[]): TocEntry[] {
  return items.map((item) => ({
    href: item.href,
    label: item.label?.trim() || "",
    subitems: item.subitems?.length
      ? toTocEntries(item.subitems as typeof items)
      : undefined,
  }));
}

const FONT_STACK: Record<ReaderSettings["fontFamily"], string> = {
  literata: "'Literata', Georgia, serif",
  lora: "'Lora', Georgia, serif",
  garamond: "'EB Garamond', Georgia, serif",
  sans: "system-ui, -apple-system, sans-serif",
  dyslexic: "'Comic Sans MS', 'Comic Sans', 'Andika', sans-serif",
};

// The iframe epub.js renders content into is a separate document — it can't
// see fonts loaded via next/font/google in the parent page — so it loads
// the same three book-typesetting families itself straight from Google
// Fonts, exactly like any other web page would.
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Literata:ital,opsz@0,7..72;1,7..72&family=Lora:ital@0;1&display=swap";

interface EpubReaderSurfaceProps {
  file: Blob;
  settings: ReaderSettings;
  /**
   * Resolved literal colors for the current theme (auto night mode /
   * custom theme already applied). Passed as hex rather than referencing
   * `var(--reader-fg)` from inside the iframe — CSS custom properties
   * don't cross that boundary, so a var() reference there silently falls
   * back to black text, invisible on dark backgrounds.
   */
  colors: { bg: string; fg: string };
  initialLocation?: string;
  onProgress: (info: ReaderProgressInfo) => void;
  onError?: (error: unknown) => void;
  onToc?: (toc: TocEntry[]) => void;
  onSelection?: (payload: SelectionPayload) => void;
  /** Existing highlights to paint once the rendition is ready. */
  highlights?: { location: string; color: string }[];
  /**
   * Fired on a plain tap/click inside the rendered content that wasn't
   * part of a text-selection drag, with the horizontal zone it landed in.
   * epub.js content lives in an iframe — a separate browsing context whose
   * events never bubble to the parent document — so page-turn/chrome-toggle
   * navigation can't be driven by overlay `<button>`s the way it can for
   * the (non-iframe) PDF surface without those buttons blocking every
   * mousedown before it ever reaches the iframe, making text selection
   * impossible. Detected here instead, from events epub.js forwards.
   */
  onTap?: (zone: "prev" | "next" | "middle") => void;
}

// Some EPUBs are malformed (broken manifest references, unresolvable CSS
// paths, etc.) and epub.js's internal resource-replacement chain can hang
// or throw deep inside its own promise chains without ever surfacing to
// book.opened. Bound how long we wait so a bad file degrades to an error
// state instead of a permanently blank/crashed reader.
const OPEN_TIMEOUT_MS = 10000;
// Fractions of the current page's own width — not raw pixels. epub.js lays
// each section out as one continuous multi-column document and only shows a
// horizontal slice of it per "page", so contents.window.innerWidth is the
// width of the *whole section* (every column back to back), not the single
// visible page; a touch's clientX is likewise measured against that full
// width. Comparing against fixed pixel counts broke as soon as a section
// spanned more than one page. Everything below works in fractions of one
// page-width instead, which stays correct regardless of section length.
// Generous on purpose: a real fingertip tap on a touchscreen naturally
// jitters by several CSS pixels between touchstart and touchend — a mouse
// click doesn't — so too tight a threshold here reliably drops real taps
// as "moved" (treated as a selection-drag) while working fine with a mouse.
const TAP_MOVE_FRACTION = 0.04;
const SWIPE_FRACTION = 0.1;
// Android's system "swipe from the edge to go back" gesture claims a thin
// strip at the left/right of the screen. A swipe starting inside that strip
// is the user reaching for the OS gesture, not our page-turn one — leave it
// alone rather than fight it for the same touch.
const EDGE_EXCLUSION_FRACTION = 0.05;

/**
 * The single visible page's width, in the same coordinate space as a touch
 * event's clientX inside the content iframe. Deliberately *not*
 * `contents.window.innerWidth` (the whole section's multi-column width,
 * confirmed by logging to be in the tens of thousands of units for a
 * several-page section — using it as "one page" broke every fraction-based
 * threshold below) and *not* any undocumented epub.js internal (guessing at
 * `rendition.manager.layout.width` didn't reliably pan out either). epub.js
 * sizes each CSS column to exactly match the stage/container it was given,
 * so this element's own rendered width is that same figure, with zero
 * dependency on epub.js internals.
 */
function getPageWidth(container: HTMLElement | null, contents: Contents): number {
  return container?.getBoundingClientRect().width || contents.window?.innerWidth || 1;
}

function pointFromEvent(e: MouseEvent | TouchEvent, which: "start" | "end"): { x: number; y: number } | null {
  if ("touches" in e) {
    const touch = which === "start" ? e.touches[0] : e.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: e.clientX, y: e.clientY };
}

export const EpubReaderSurface = forwardRef<ReaderSurfaceHandle, EpubReaderSurfaceProps>(
  function EpubReaderSurface(
    { file, settings, colors, initialLocation, onProgress, onError, onToc, onSelection, highlights, onTap },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const bookRef = useRef<EpubBook | null>(null);
    // Keep the latest callbacks without re-running the (expensive) init effect on every render.
    const onProgressRef = useRef(onProgress);
    onProgressRef.current = onProgress;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const onTocRef = useRef(onToc);
    onTocRef.current = onToc;
    const onSelectionRef = useRef(onSelection);
    onSelectionRef.current = onSelection;
    const onTapRef = useRef(onTap);
    onTapRef.current = onTap;
    const highlightsRef = useRef(highlights);
    highlightsRef.current = highlights;
    const colorsRef = useRef(colors);
    colorsRef.current = colors;
    const { t } = useTranslation();
    const tRef = useRef(t);
    tRef.current = t;
    const pageTurnAnimRef = useRef(settings.pageTurnAnimation);
    pageTurnAnimRef.current = settings.pageTurnAnimation;
    const scrollModeRef = useRef(settings.scrollMode);
    scrollModeRef.current = settings.scrollMode;
    // Tracks the margin currently reflected in the container's own padding,
    // so the settings effect only forces an epub.js resize (expensive
    // reflow) when the margin actually changed.
    const appliedMarginRef = useRef<number | null>(null);
    const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [curl, setCurl] = useState<"next" | "prev" | null>(null);
    const curlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Triggered directly from an explicit next()/prev() call — not from
    // epub.js's "relocated" event. "relocated" can fire more than once for
    // a single navigation (it also fires for the background locations.generate()
    // refresh, TOC/search/bookmark jumps, etc.), and re-triggering an
    // animation mid-flight each time it fires left it visibly stuck instead
    // of ever completing. Driving it from our own call site means it fires
    // exactly once per real page turn.
    const triggerPageTurnAnimation = (direction: "next" | "prev") => {
      if (pageTurnAnimRef.current <= 0) return;
      if (pageTurnAnimRef.current === 2) {
        if (curlTimerRef.current) clearTimeout(curlTimerRef.current);
        setCurl(direction);
        curlTimerRef.current = setTimeout(() => setCurl(null), PAGE_CURL_TOTAL_MS);
        return;
      }
      if (!containerRef.current) return;
      const el = containerRef.current;
      el.classList.remove("epub-page-turn-animate-next", "epub-page-turn-animate-prev");
      void el.offsetWidth; // restart the CSS animation
      el.classList.add(`epub-page-turn-animate-${direction}`);
    };

    useImperativeHandle(ref, () => ({
      next: () => {
        triggerPageTurnAnimation("next");
        void renditionRef.current?.next();
      },
      prev: () => {
        triggerPageTurnAnimation("prev");
        void renditionRef.current?.prev();
      },
      goToStart: () => void renditionRef.current?.display(),
      goToEnd: () => {
        const lastHref = bookRef.current?.spine?.last()?.href;
        if (lastHref) void renditionRef.current?.display(lastHref);
      },
      goToHref: (href: string) => void renditionRef.current?.display(href),
      goToLocation: (location: string) => void renditionRef.current?.display(location),
      applyHighlight: (location: string, color: string) => {
        renditionRef.current?.annotations.highlight(location, {}, undefined, "", {
          fill: color,
          "fill-opacity": "0.4",
          "mix-blend-mode": "multiply",
        });
      },
      removeHighlight: (location: string) => {
        renditionRef.current?.annotations.remove(location, "highlight");
      },
      search: async (query, options) => {
        const book = bookRef.current;
        const trimmed = query.trim();
        if (!book || !trimmed) return [];
        const sections = (book.spine as unknown as { spineItems: EpubSearchSection[] })
          .spineItems;
        return searchEpubSections(sections, book.load.bind(book), trimmed, options);
      },
      getCurrentText: async () => {
        // epub.js's own types claim this returns a single Contents, but at
        // runtime it's an array (one per visible page — two in spread mode).
        const contentsArr = (renditionRef.current?.getContents() ?? []) as unknown as Contents[];
        return contentsArr
          .map((c) => c.document?.body?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join("\n\n");
      },
    }));

    useEffect(() => {
      let cancelled = false;
      let reported = false;
      const reportOnce = (err: unknown) => {
        if (reported || cancelled) return;
        reported = true;
        onErrorRef.current?.(err);
      };

      // epub.js does some of its work (rAF-scheduled location reporting,
      // iframe load handlers) outside any promise chain we can await or
      // wrap in try/catch during the initial open. A malformed book can
      // throw synchronously in there, which would otherwise crash the
      // whole page. Catch it at the window level — but only until the book
      // has actually opened: left on indefinitely, this net is too wide and
      // swallows *any* later unrelated error on the page (e.g. a Base UI
      // popup's outside-press handler tripping over a native color-picker
      // dismissal) as if the book itself had crashed.
      const onWindowError = (event: ErrorEvent) => reportOnce(event.error ?? event.message);
      const onUnhandledRejection = (event: PromiseRejectionEvent) => reportOnce(event.reason);
      window.addEventListener("error", onWindowError);
      window.addEventListener("unhandledrejection", onUnhandledRejection);
      const stopWatchingWindowErrors = () => {
        window.removeEventListener("error", onWindowError);
        window.removeEventListener("unhandledrejection", onUnhandledRejection);
      };

      (async () => {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const book = ePub(arrayBuffer);
          bookRef.current = book;

          await Promise.race([
            (async () => {
              await book.ready;
              await book.opened;
            })(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(tRef.current("epub.openTimeout"))), OPEN_TIMEOUT_MS)
            ),
          ]);
          if (cancelled || !containerRef.current) return;

          const navigation = await book.loaded.navigation;
          if (!cancelled && navigation?.toc?.length) {
            onTocRef.current?.(toTocEntries(navigation.toc));
          }

          // Applied before renderTo so epub.js's initial stage measurement
          // already accounts for the margin (see the margin/resize note below).
          containerRef.current.style.padding = `0 ${settings.margin}px`;
          appliedMarginRef.current = settings.margin;

          const rendition = book.renderTo(containerRef.current, {
            width: "100%",
            height: "100%",
            flow: settings.scrollMode ? "scrolled-doc" : "paginated",
            spread: settings.columns === 2 ? "always" : "none",
            allowScriptedContent: false,
          });
          renditionRef.current = rendition;

          // Runs once per section as its iframe document is created.
          rendition.hooks.content.register((contents: Contents) => {
            const doc = contents.document;
            if (doc.getElementById("paperlike-fonts")) return;
            const link = doc.createElement("link");
            link.id = "paperlike-fonts";
            link.rel = "stylesheet";
            link.href = GOOGLE_FONTS_HREF;
            doc.head?.appendChild(link);
          });

          rendition.themes.default({
            "html, body": { background: "transparent !important" },
            "a, a:link": { color: "inherit !important" },
          });
          applySettings(rendition, settings, colorsRef.current);

          const reportProgress = (location: EpubLocation) => {
            const href = location?.start?.href;
            const chapter = href ? book.navigation?.get(href) : undefined;
            onProgressRef.current({
              label: chapter?.label?.trim() || "",
              percentage: Math.round((location?.start?.percentage ?? 0) * 100),
              location: location?.start?.cfi ?? "",
            });
          };

          rendition.on("relocated", reportProgress);
          rendition.on("displayError", (err: unknown) => onErrorRef.current?.(err));
          rendition.on("selected", (cfiRange: string, contents: Contents) => {
            const text = contents.range(cfiRange)?.toString().trim() ?? "";
            if (text) onSelectionRef.current?.({ text, location: cfiRange });
          });

          // epub.js forwards raw DOM events from inside the content iframe
          // through the rendition's own emitter (Contents.addEventListeners
          // -> Rendition.passEvents) — this is the only way to distinguish
          // a tap from a selection-drag in there, since the iframe is a
          // separate browsing context real pointer events never bubble out of.
          let downPos: { x: number; y: number } | null = null;
          // Touchscreens fire a synthetic, compatibility mousedown/mouseup
          // shortly after every real touchstart/touchend — without this,
          // every tap ran through onUp *twice*, and since toggleChrome is a
          // toggle (not idempotent), the second call undid what the first
          // one just did (chrome opened, then immediately closed again).
          let lastTouchTime = 0;
          const isGhostMouseEvent = (e: MouseEvent | TouchEvent) =>
            !("touches" in e) && Date.now() - lastTouchTime < 800;
          const onDown = (e: MouseEvent | TouchEvent) => {
            if ("touches" in e) lastTouchTime = Date.now();
            else if (isGhostMouseEvent(e)) return;
            downPos = pointFromEvent(e, "start");
          };
          const onUp = (e: MouseEvent | TouchEvent, contents: Contents) => {
            if ("touches" in e) lastTouchTime = Date.now();
            else if (isGhostMouseEvent(e)) return;
            const start = downPos;
            downPos = null;
            const end = pointFromEvent(e, "end");
            if (!start || !end) return;
            const pageWidth = getPageWidth(containerRef.current, contents);
            const dx = end.x - start.x;
            const dy = end.y - start.y;

            const localStartX = ((start.x % pageWidth) + pageWidth) % pageWidth;
            const startedInEdgeStrip =
              localStartX < pageWidth * EDGE_EXCLUSION_FRACTION ||
              localStartX > pageWidth * (1 - EDGE_EXCLUSION_FRACTION);

            // A fast horizontal drag — the "flip the page" gesture most
            // readers expect — regardless of where it started/ended. Unless
            // it started in the system back-gesture strip, in which case
            // leave that touch to Android rather than also acting on it.
            // Skipped entirely in scroll mode — vertical dragging there is
            // just the reader's own scroll, not a page-turn swipe.
            if (
              !scrollModeRef.current &&
              !startedInEdgeStrip &&
              Math.abs(dx) > pageWidth * SWIPE_FRACTION &&
              Math.abs(dx) > Math.abs(dy)
            ) {
              onTapRef.current?.(dx < 0 ? "next" : "prev");
              return;
            }

            const moved =
              Math.abs(dx) > pageWidth * TAP_MOVE_FRACTION ||
              Math.abs(dy) > pageWidth * TAP_MOVE_FRACTION;
            if (moved) return; // ambiguous small drag — leave it to text selection

            // No more left/right edge zones — page turning is swipe-only
            // now (handled above). Any plain tap just toggles the chrome.
            onTapRef.current?.("middle");
          };
          rendition.on("mousedown", onDown);
          rendition.on("touchstart", onDown);
          rendition.on("mouseup", onUp);
          rendition.on("touchend", onUp);

          // epub.js re-attaches annotations to a section automatically every
          // time that section renders (Annotations registers its own
          // `render` hook internally) — adding each one once here is enough.
          for (const h of highlightsRef.current ?? []) {
            rendition.annotations.highlight(h.location, {}, undefined, "", {
              fill: h.color,
              "fill-opacity": "0.4",
              "mix-blend-mode": "multiply",
            });
          }

          await rendition.display(initialLocation);
          stopWatchingWindowErrors();

          // Generating locations is CPU-heavy on large books. Defer it until
          // the first page is interactive and adapt the density so location
          // density (and memory use) is controlled as file size grows.
          locationTimerRef.current = setTimeout(() => {
            locationTimerRef.current = null;
            void book.locations
              .generate(getEpubLocationBreak(file.size))
              .then(() => {
                if (cancelled) return;
                const current = rendition.location;
                if (current) reportProgress(current);
              })
              .catch(() => {
                // Exact percentages are optional; reading remains available
                // if a malformed spine prevents location generation.
              });
          }, 500);
        } catch (err) {
          reportOnce(err);
        }
      })();

      return () => {
        cancelled = true;
        stopWatchingWindowErrors();
        if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
        if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
        if (curlTimerRef.current) clearTimeout(curlTimerRef.current);
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
        renditionRef.current = null;
        bookRef.current = null;
      };
      // Settings changes are applied in the effect below without re-creating
      // the rendition; only re-init when the file itself changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    useEffect(() => {
      const rendition = renditionRef.current;
      const container = containerRef.current;
      if (!rendition || !container) return;
      applySettings(rendition, settings, colors);

      // epub.js recomputes its own body padding/margin on every internal
      // layout pass (Contents.size()), silently overwriting anything set
      // via themes.override("padding", ...). Sizing the *container epub.js
      // renders into* instead sidesteps that fight entirely — but epub.js
      // only re-measures that container on `resize()`, not via a
      // ResizeObserver, so we call it explicitly when the margin changes.
      if (appliedMarginRef.current !== settings.margin) {
        container.style.padding = `0 ${settings.margin}px`;
        appliedMarginRef.current = settings.margin;
        // The margin slider fires onChange continuously while dragging.
        // rendition.resize() tears down and recreates epub.js's internal
        // views (Manager.clear() -> updateLayout()); calling it on every
        // intermediate tick can race with itself and throw deep inside
        // epub.js (a torn-down view's iframe window going null mid-layout).
        // Debounce so it only actually resizes once dragging settles.
        if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = setTimeout(() => {
          resizeTimerRef.current = null;
          try {
            // epub.js's own types mark resize(width, height) as required,
            // but at runtime it's designed to be called with no args
            // (that's exactly how its internal window-resize handler calls
            // it) to re-measure the container instead of forcing a size.
            (rendition.resize as () => void)();
          } catch {
            // epub.js can throw deep inside its own view-recreation if the
            // rendition was torn down right as this fires; safe to ignore,
            // the next settled resize (or page turn) will catch up.
          }
        }, 200);
      }
    }, [settings, colors]);

    return (
      <div className="relative h-full w-full">
        <div ref={containerRef} className="h-full w-full" />
        {curl && <PageCurlOverlay direction={curl} bg={colors.bg} />}
      </div>
    );
  }
);

function applySettings(rendition: Rendition, settings: ReaderSettings, colors: { fg: string }) {
  rendition.themes.fontSize(`${settings.fontSize}px`);
  rendition.themes.font(FONT_STACK[settings.fontFamily]);
  rendition.themes.override("line-height", String(settings.lineHeight), true);
  rendition.themes.override("color", colors.fg, true);
  rendition.spread(settings.columns === 2 ? "always" : "none");
  rendition.flow(settings.scrollMode ? "scrolled-doc" : "paginated");
}
