"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Book } from "@/lib/types";
import { BookCover } from "@/components/library/BookCover";

const HOLD_MS = 850;
const PAGE_COLOR = "#f9f6ee";

// Two-stage timing: a brief "picked up" beat (0 -> 0.16) where nothing
// rotates yet, then the open swing (0.16 -> 1) with a slight overshoot
// past its resting angle before settling — like a physical object with
// a little momentum, not a linear robotic sweep.
const OPEN_TIMES = [0, 0.16, 0.88, 1];
const ROTATE_KEYFRAMES = [0, 0, -128, -122];
const SCALE_KEYFRAMES = [1, 1.05, 0.96, 0.96];
const OPEN_DURATION = 0.85;
const OPEN_EASE = [0.33, 1, 0.4, 1] as const;

/**
 * A brief "cover swings open" reveal shown once when the reader first opens
 * a book. A fanned page stack sits behind the cover so opening it reveals
 * paper, not void; the cover has a real backface (also blank paper) instead
 * of showing its own artwork mirrored past 90°; and a hinge-anchored shadow
 * sweeps across as it turns, instead of a flat overlay darkening evenly.
 */
export function BookOpenTransition({ book, onDone }: { book: Book; onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{
            background: "radial-gradient(ellipse at center, #211a14 0%, #000000 72%)",
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, delay: 0.55, ease: "easeOut" }}
        >
          <motion.div
            className="relative w-36 sm:w-44"
            style={{ aspectRatio: "2 / 3", perspective: 1400 }}
            initial={{ scale: SCALE_KEYFRAMES[0] }}
            animate={{ scale: SCALE_KEYFRAMES }}
            transition={{ duration: OPEN_DURATION, times: OPEN_TIMES, ease: OPEN_EASE }}
          >
            {/* Soft grounding shadow the book casts on the backdrop. */}
            <div
              className="absolute -inset-x-6 top-[102%] h-4 rounded-[100%] blur-md"
              style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)" }}
            />

            {/* Fanned page stack — three offset layers instead of one flat
                block, closer to the edge of a real page block. */}
            <div className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-r-[3px] rounded-l-[1px] bg-[#e4d9bf]" />
            <div className="absolute inset-0 translate-x-[1.5px] translate-y-[1.5px] rounded-r-[3px] rounded-l-[1px] bg-[#eee3cb]" />
            <div
              className="absolute inset-0 overflow-hidden rounded-r-[3px] rounded-l-[1px]"
              style={{
                backgroundColor: PAGE_COLOR,
                boxShadow: "inset -3px 0 6px rgba(0,0,0,0.12)",
              }}
            />

            <motion.div
              className="absolute inset-0 origin-left"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ rotateY: ROTATE_KEYFRAMES[0] }}
              animate={{ rotateY: ROTATE_KEYFRAMES }}
              transition={{ duration: OPEN_DURATION, times: OPEN_TIMES, ease: OPEN_EASE }}
            >
              {/* Front face — the artwork. Hidden once rotated past 90deg
                  instead of showing itself mirrored. */}
              <div
                className="absolute inset-0 overflow-hidden rounded-r-md shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
                style={{ backfaceVisibility: "hidden" }}
              >
                <BookCover book={book} eager />
                {/* Shadow sweeps out from the hinge (left) as it turns,
                    instead of darkening the whole face evenly. */}
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "linear-gradient(to right, rgba(0,0,0,0.7), transparent 65%)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0, 0.85, 0.85] }}
                  transition={{ duration: OPEN_DURATION, times: OPEN_TIMES, ease: OPEN_EASE }}
                />
              </div>
              {/* Back face — the inside of the cover: blank paper, not the
                  artwork reversed. Only visible past 90deg of rotation. */}
              <div
                className="absolute inset-0 overflow-hidden rounded-l-md"
                style={{
                  backgroundColor: PAGE_COLOR,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
