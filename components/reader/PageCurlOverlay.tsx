"use client";

import { motion } from "framer-motion";

const STRIP_COUNT = 10;
const STEP_DELAY = 0.02;
const STRIP_DURATION = 0.38;

/** Total time the overlay needs on screen — callers use this to know when to unmount it. */
export const PAGE_CURL_TOTAL_MS = Math.round((STEP_DELAY * (STRIP_COUNT - 1) + STRIP_DURATION) * 1000);

/**
 * A "page curling away in strips" reveal, layered over content that has
 * already changed underneath. Real per-pixel content curling would need a
 * snapshot of the outgoing page (html2canvas for EPUB's iframe, canvas
 * read-back for PDF) — feasible for PDF, but iframe capture is a known
 * source of flaky, hard-to-debug failures, and this app already burned two
 * rounds on animation bugs. A staggered wave of plain strips, tinted to the
 * current reader theme, gets most of the perceived "it's curling, not just
 * rotating" effect without touching real content at all — zero risk of
 * rendering the wrong pixels.
 */
export function PageCurlOverlay({
  direction,
  bg,
}: {
  direction: "next" | "prev";
  bg: string;
}) {
  const isNext = direction === "next";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      style={{ perspective: 1400 }}
      aria-hidden
    >
      {Array.from({ length: STRIP_COUNT }, (_, i) => {
        // Strip closest to the turning edge moves first; the wave travels
        // outward from there — near the spine on "next", from the right on "prev".
        const waveIndex = isNext ? i : STRIP_COUNT - 1 - i;
        const leftPct = (i / STRIP_COUNT) * 100;
        const widthPct = 100 / STRIP_COUNT + 0.5; // slight overlap hides seams
        return (
          <motion.div
            key={i}
            className="absolute inset-y-0"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              transformOrigin: isNext ? "left center" : "right center",
              backgroundColor: bg,
            }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: isNext ? -150 : 150 }}
            transition={{
              duration: STRIP_DURATION,
              delay: waveIndex * STEP_DELAY,
              ease: [0.45, 0, 0.2, 1],
            }}
          >
            {/* Per-strip fold shading — darkest at the leading edge. */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(${isNext ? "to right" : "to left"}, rgba(0,0,0,0.32), transparent 65%)`,
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
