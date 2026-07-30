"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import { coverCache, type CoverLease } from "@/lib/cover-cache";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-rose-200 to-orange-100",
  "from-sky-200 to-indigo-100",
  "from-emerald-200 to-teal-100",
  "from-amber-200 to-yellow-100",
  "from-violet-200 to-fuchsia-100",
  "from-slate-300 to-zinc-100",
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export function BookCover({ book, eager = false }: { book: Book; eager?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let active = false;
    let lease: CoverLease | undefined;
    let requestVersion = 0;

    const setVisible = (visible: boolean) => {
      if (active === visible) return;
      active = visible;
      requestVersion += 1;
      const version = requestVersion;
      if (!visible) {
        lease?.release();
        lease = undefined;
        setSrc(null);
        return;
      }
      void coverCache.acquire(book.id).then((nextLease) => {
        if (cancelled || !active || version !== requestVersion) {
          nextLease?.release();
          return;
        }
        lease = nextLease;
        setSrc(nextLease?.url ?? null);
      });
    };

    const element = containerRef.current;
    let observer: IntersectionObserver | undefined;
    if (!eager && element && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => setVisible(entry.isIntersecting),
        { rootMargin: "300px 0px" }
      );
      observer.observe(element);
    } else {
      setVisible(true);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      lease?.release();
    };
  }, [book.id, eager]);

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- blob: URLs can't go through next/image's optimizer
    return (
      <div ref={containerRef} className="h-full w-full">
        <img
          src={src}
          alt={book.title}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br p-4 text-center",
        gradientFor(book.id)
      )}
    >
      {book.format === "pdf" ? (
        <FileText className="size-6 text-black/35" strokeWidth={1.5} />
      ) : (
        <BookOpen className="size-6 text-black/35" strokeWidth={1.5} />
      )}
      <span className="font-reader-serif line-clamp-4 text-[13px] font-medium leading-snug text-black/70">
        {book.title}
      </span>
    </div>
  );
}
