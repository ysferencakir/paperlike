"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Book, ReadingProgress } from "@/lib/types";
import { spineColorFor } from "@/lib/book-color";
import { coverCache } from "@/lib/cover-cache";
import { getProgress } from "@/lib/storage";
import { formatBytes, formatRelativeDate } from "@/lib/utils";
import { BookCover } from "./BookCover";
import { BookActionsMenu } from "./BookActionsMenu";
import { useTranslation } from "@/lib/i18n/useTranslation";

const ROW_HEIGHT = 184;
const PLANK_HEIGHT = 10;
const SPINE_WIDTH = 34;
const SPINE_HEIGHT = 156;
const COVER_WIDTH = 104;

// Two-stage reveal: first pull toward the viewer (z up, slight scale) with
// no turn yet, then swing left while the rotation opens the cover into
// view — "gelip sola hareket ederek" rather than a flat in-place flip.
// rotateY goes negative because the cover face is hinged at +90deg
// relative to the box (see below): box(-102) + cover(90) ≈ 0, facing the
// viewer; the opposite sign would drive the cover further away instead.
const bookVariants = {
  rest: { rotateY: 0, x: 0, z: 0, scale: 1 },
  open: {
    rotateY: [0, 0, -102],
    x: [0, 0, -34],
    z: [0, 46, 14],
    scale: [1, 1.1, 1.02],
  },
};
const BOOK_TRANSITION = { duration: 0.55, times: [0, 0.38, 1], ease: [0.33, 1, 0.4, 1] as const };

// backface-visibility alone doesn't reliably hide the spine face here: it's
// a child that gets an *additional* static rotateY from the cover face's own
// hinge transform composed on top of the animated parent rotation, and that
// compound (parent-animated + child-static) preserve-3d case is where
// Chromium's depth handling isn't trustworthy — the spine title stayed
// visible, ghosted, through the turned cover. A plain CSS opacity fade is a
// render-mode-independent guarantee instead of relying on 3D math alone.
// Deliberately a CSS transition on a plain div, not a second framer-motion
// element: giving the spine face its *own* animate/variants inside the same
// preserve-3d parent made the browser flatten the whole box instead of
// composing the two — the box rendered flat ("kağıt gibi") instead of as a
// 3D object, even at rest.

const UNCATEGORIZED = "Kategorisiz";

// Named categories alphabetically first, uncategorized books trail in their
// own shelf last — that group is the fallback, not a "real" category.
function groupByCategory(books: Book[], compareLocale: string): Array<[string, Book[]]> {
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const key = book.category?.trim() || UNCATEGORIZED;
    const group = groups.get(key);
    if (group) group.push(book);
    else groups.set(key, [book]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b, compareLocale);
  });
}

/**
 * Books rest spine-out, packed tight like a real shelf — a slim edge with
 * the title running vertically, colored from the actual cover art (the
 * left-edge strip, averaged) instead of an arbitrary hash. Hovering pulls
 * the book toward you, then swings it left to reveal the cover, with the
 * title/author/format appearing beside it; the rest of the shelf softly
 * blurs. Built as a real two-faced 3D box (spine face + cover face, hinged
 * with `preserve-3d` + `backface-visibility`, origin pinned to the spine
 * edge) — the same technique proven in the book-opening transition.
 *
 * Each CSS grid row wraps to a new shelf automatically once one fills up —
 * no manual "next shelf" logic needed. Books carrying a `category` get
 * split into their own labeled shelf group instead of one continuous run;
 * with no categories assigned anywhere, the label row is skipped entirely
 * so an uncategorized library still reads as a single plain shelf.
 */
export function ShelfView({ books }: { books: Book[] }) {
  const { t, locale } = useTranslation();
  const groups = groupByCategory(books, locale === "tr" ? "tr" : "en");
  const showLabels = !(groups.length === 1 && groups[0][0] === UNCATEGORIZED);

  return (
    <div className="flex flex-col gap-8">
      {groups.map(([category, groupBooks]) => (
        <section key={category}>
          {showLabels && (
            <h3 className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {category === UNCATEGORIZED ? t("shelf.uncategorized") : category}
              <span className="ml-1.5 font-normal normal-case text-muted-foreground/60">
                {t("shelf.categoryBookCount", { count: groupBooks.length })}
              </span>
            </h3>
          )}
          <ShelfRow books={groupBooks} />
        </section>
      ))}
    </div>
  );
}

function ShelfRow({ books }: { books: Book[] }) {
  const plankStart = ROW_HEIGHT - PLANK_HEIGHT;
  return (
    <div className="relative">
      {/* Ambient vignette — a soft falloff toward the edges instead of flat,
          even lighting, the cheapest cue that this is a lit physical space
          rather than a UI grid. Theme-safe: mixes with the foreground color
          so it stays coherent across light/dark/sepia. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 25%, transparent 45%, color-mix(in oklch, var(--color-foreground) 7%, transparent) 100%)",
        }}
      />
      <div
        className="shelf-grid grid"
        style={{
          gridTemplateColumns: `repeat(auto-fill, ${SPINE_WIDTH}px)`,
          gridAutoRows: `${ROW_HEIGHT}px`,
          justifyContent: "start",
          columnGap: 2,
          // Each row's plank reads as a physical beveled edge, not a flat
          // line: a soft contact shadow where the books meet it, a crisp
          // top edge, a slightly receding body, and a brighter bottom lip
          // catching light — all in one repeating background, so every book
          // sits "grounded" without any per-book shadow markup.
          backgroundImage: `repeating-linear-gradient(to bottom,
            transparent 0,
            transparent ${plankStart - 10}px,
            color-mix(in oklch, var(--color-foreground) 12%, transparent) ${plankStart - 2}px,
            color-mix(in oklch, var(--color-foreground) 32%, transparent) ${plankStart}px,
            color-mix(in oklch, var(--color-foreground) 16%, transparent) ${ROW_HEIGHT - 2}px,
            color-mix(in oklch, var(--color-foreground) 36%, transparent) ${ROW_HEIGHT}px
          )`,
        }}
      >
        {books.map((book) => (
          <ShelfBook key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}

function ShelfBook({ book }: { book: Book }) {
  const { t, locale } = useTranslation();
  const [spineColor, setSpineColor] = useState(() => spineColorFor(book.id));
  const [progress, setProgress] = useState<ReadingProgress | undefined>();
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    coverCache.getSpineColor(book.id).then((color) => {
      if (color && !cancelled) setSpineColor(color);
    });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  useEffect(() => {
    let cancelled = false;
    getProgress(book.id).then((p) => {
      if (!cancelled) setProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  // Hover is tracked on this stable, never-transformed wrapper rather than
  // via whileHover on the box that actually rotates/translates: as the box
  // swings away from under a stationary cursor mid-animation, its hit
  // region sweeps out from under the pointer, so whileHover directly on it
  // fires a spurious pointerleave (box moves back to rest → moves back
  // under the cursor → re-triggers → flicker/stuck loop). The short leave
  // delay below absorbs that same gap for the wrapper too, since the box's
  // rendered geometry momentarily leaving the pointer's position is a real
  // geometric event, not just a DOM-hierarchy quirk.
  const handleEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setHovered(true);
  };
  const handleLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHovered(false), 150);
  };

  // Clicking the "..." trigger was still navigating to the reader despite
  // stopPropagation on the button itself — the trigger is composed through
  // base-ui's Menu.Trigger `render` prop, and something in that chain (or
  // in how a click resolves inside this 3D-transformed box) wasn't
  // actually stopping it from reaching the Link. Checking the click target
  // here, at the Link's own onClick — the exact extension point Next.js
  // gives for exactly this "don't navigate" case — doesn't depend on any
  // of that: it only cares what element was actually clicked.
  const handleLinkClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-menu-trigger]")) {
      e.preventDefault();
    }
  };

  return (
    <Link
      href={`/reader?bookId=${book.id}`}
      className="shelf-book group relative flex items-end justify-center pb-[10px] transition-[filter] duration-300 ease-out"
      style={{ height: ROW_HEIGHT }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleLinkClick}
    >
      <div
        className="relative group-hover:z-20"
        style={{ perspective: 1000, width: SPINE_WIDTH, height: SPINE_HEIGHT }}
      >
        {/* Backdrop halo — without this, the popped-out cover swings left
            over the still-sharp edge of the neighboring spine, so its title
            text visibly shows through underneath. A soft background-colored
            blur plate behind the box masks that overlap. */}
        <div
          className="pointer-events-none absolute rounded-2xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-95"
          style={{ left: -44, right: -8, top: -14, bottom: -14, background: "var(--color-background)" }}
        />
        <motion.div
          className="relative"
          style={{
            transformStyle: "preserve-3d",
            transformOrigin: "left center",
            width: SPINE_WIDTH,
            height: SPINE_HEIGHT,
          }}
          initial="rest"
          animate={hovered ? "open" : "rest"}
          variants={bookVariants}
          transition={BOOK_TRANSITION}
        >
          {/* Spine face — visible at rest, tinted from the cover's own edge. */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-[1px] py-2 shadow-[1px_2px_5px_rgba(0,0,0,0.35)] transition-[background-color,opacity] duration-300"
            style={{
              backgroundColor: spineColor,
              backgroundImage:
                "linear-gradient(90deg, rgba(0,0,0,0.25), transparent 18%, transparent 70%, rgba(0,0,0,0.2))",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              opacity: hovered ? 0 : 1,
            }}
          >
            <span className="h-1 w-3 shrink-0 rounded-full bg-white/25" />
            <span
              className="line-clamp-[10] flex-1 text-center text-[10.5px] font-medium leading-tight tracking-wide text-white/90"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            >
              {book.title}
            </span>
            <span className="h-1 w-3 shrink-0 rounded-full bg-white/25" />
          </div>

          {/* Cover face — hinged to the spine's left edge (90deg relative,
              so it lies folded flat against the spine at rest) — hidden
              until the box rotates enough to bring it net-flat toward
              the viewer. */}
          <div
            className="absolute left-0 top-0 h-full overflow-hidden rounded-r-[3px] rounded-l-[1px] shadow-[4px_6px_16px_rgba(0,0,0,0.4)]"
            style={{
              width: COVER_WIDTH,
              transformOrigin: "left center",
              transform: "rotateY(90deg)",
              backfaceVisibility: "hidden",
            }}
          >
            <BookCover book={book} />
            {/* Fold shadow at the hinge — the visual cue that was missing
                before, giving the cover some sense of depth against the spine. */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-3"
              style={{ background: "linear-gradient(to right, rgba(0,0,0,0.35), transparent)" }}
            />
            <div
              data-menu-trigger
              className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              <BookActionsMenu book={book} />
            </div>
          </div>
        </motion.div>

        {/* Info card — a sibling of the rotating box, not a child of it:
            preserve-3d applies to descendants too, so nesting this inside
            the box would have swung it out of view right along with the
            cover. Appears beside the revealed cover once it's turned. */}
        <div
          className="pointer-events-none absolute top-0 max-w-[10rem] -translate-x-1 whitespace-nowrap opacity-0 transition-all delay-200 duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          style={{ left: COVER_WIDTH - 24 }}
        >
          <div className="flex flex-col gap-1.5 rounded-xl bg-popover/95 px-3 py-2.5 text-left shadow-lg ring-1 ring-foreground/10 backdrop-blur-xl">
            <span className="line-clamp-2 whitespace-normal text-[12px] font-medium leading-snug text-foreground">
              {book.title}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">{book.author}</span>
            <span className="w-fit rounded-md bg-muted px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide text-muted-foreground">
              {t(book.format === "epub" ? "format.epub" : "format.pdf")}
            </span>

            {progress ? (
              <div className="flex flex-col gap-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground/70"
                    style={{ width: `${Math.round(progress.percentage)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {t("shelf.progress", {
                    percentage: Math.round(progress.percentage),
                    relativeDate: formatRelativeDate(progress.updatedAt, t),
                  })}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">{t("shelf.notStarted")}</span>
            )}

            <span className="whitespace-normal text-[9.5px] leading-snug text-muted-foreground/70">
              {t("shelf.sizeAndAdded", {
                size: formatBytes(book.fileSize),
                date: new Date(book.addedAt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US"),
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
