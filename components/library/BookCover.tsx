"use client";

import { useEffect, useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import { getBookCover } from "@/lib/storage";
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

export function BookCover({ book }: { book: Book }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getBookCover(book.id).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.id]);

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- blob: URLs can't go through next/image's optimizer
    return <img src={src} alt={book.title} className="h-full w-full object-cover" />;
  }

  return (
    <div
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
