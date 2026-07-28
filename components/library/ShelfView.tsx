"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Book } from "@/lib/types";
import { spineColorFor } from "@/lib/book-color";
import { extractSpineColor } from "@/lib/extract-cover-color";
import { getBookCover } from "@/lib/storage";
import { BookCover } from "./BookCover";
import { BookActionsMenu } from "./BookActionsMenu";

const ROW_HEIGHT = 184;
const PLANK_HEIGHT = 10;
const SPINE_WIDTH = 34;
const SPINE_HEIGHT = 156;
const COVER_WIDTH = 104;

const FORMAT_LABEL: Record<Book["format"], string> = {
  epub: "EPUB",
  pdf: "PDF",
};

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

/**
 * Books rest spine-out, packed tight like a real shelf — a slim edge with
 * the title running vertically, colored from the actual cover art (the
 * left-edge strip, averaged) instead of an arbitrary hash. Hovering pulls
 * the book toward you, then swings it left to reveal the cover, with the
 * title/author/format appearing beside it; the rest of the shelf softly
 * blurs. Built as a real two-faced 3D box (spine face + cover face, hinged
 * with `preserve-3d` + `backface-visibility`, origin pinned to the spine
 * edge) — the same technique proven in the book-opening transition.
 */
export function ShelfView({ books }: { books: Book[] }) {
  return (
    <div
      className="shelf-grid grid"
      style={{
        gridTemplateColumns: `repeat(auto-fill, ${SPINE_WIDTH}px)`,
        gridAutoRows: `${ROW_HEIGHT}px`,
        justifyContent: "start",
        columnGap: 2,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${
          ROW_HEIGHT - PLANK_HEIGHT
        }px, color-mix(in oklch, var(--color-foreground) 18%, transparent) ${
          ROW_HEIGHT - PLANK_HEIGHT
        }px, color-mix(in oklch, var(--color-foreground) 18%, transparent) ${ROW_HEIGHT}px)`,
      }}
    >
      {books.map((book) => (
        <ShelfBook key={book.id} book={book} />
      ))}
    </div>
  );
}

function ShelfBook({ book }: { book: Book }) {
  const [spineColor, setSpineColor] = useState(() => spineColorFor(book.id));
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBookCover(book.id).then(async (blob) => {
      if (!blob || cancelled) return;
      const color = await extractSpineColor(blob);
      if (color && !cancelled) setSpineColor(color);
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

  return (
    <Link
      href={`/reader/${book.id}`}
      className="shelf-book group relative flex items-end justify-center pb-[10px] transition-[filter] duration-300 ease-out"
      style={{ height: ROW_HEIGHT }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className="relative group-hover:z-20"
        style={{ perspective: 1000, width: SPINE_WIDTH, height: SPINE_HEIGHT }}
      >
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
            className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-[1px] py-2 shadow-[1px_2px_5px_rgba(0,0,0,0.35)] transition-[background-color] duration-500"
            style={{
              backgroundColor: spineColor,
              backgroundImage:
                "linear-gradient(90deg, rgba(0,0,0,0.25), transparent 18%, transparent 70%, rgba(0,0,0,0.2))",
              backfaceVisibility: "hidden",
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
            <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
          <div className="flex flex-col gap-1 rounded-xl bg-popover/95 px-3 py-2 text-left shadow-lg ring-1 ring-foreground/10 backdrop-blur-xl">
            <span className="line-clamp-2 whitespace-normal text-[12px] font-medium leading-snug text-foreground">
              {book.title}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">{book.author}</span>
            <span className="w-fit rounded-md bg-muted px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide text-muted-foreground">
              {FORMAT_LABEL[book.format]}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
