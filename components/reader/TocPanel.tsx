"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TocEntry } from "./types";

export function TocPanel({
  open,
  onOpenChange,
  toc,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  toc: TocEntry[];
  onNavigate: (href: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="gap-0 border-none bg-popover/95 px-0 pb-6 pt-3 shadow-2xl backdrop-blur-xl"
      >
        <SheetHeader className="px-5 pb-3">
          <SheetTitle className="text-[15px]">İçindekiler</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col overflow-y-auto px-2">
          {toc.map((item, i) => (
            <TocRow key={`${item.href}-${i}`} item={item} depth={0} onNavigate={onNavigate} onOpenChange={onOpenChange} />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function TocRow({
  item,
  depth,
  onNavigate,
  onOpenChange,
}: {
  item: TocEntry;
  depth: number;
  onNavigate: (href: string) => void;
  onOpenChange: (value: boolean) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onNavigate(item.href);
          onOpenChange(false);
        }}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        className="rounded-lg py-2 pr-3 text-left text-[13px] leading-snug text-foreground hover:bg-muted"
      >
        {item.label || "Adsız Bölüm"}
      </button>
      {item.subitems?.map((sub, i) => (
        <TocRow key={`${sub.href}-${i}`} item={sub} depth={depth + 1} onNavigate={onNavigate} onOpenChange={onOpenChange} />
      ))}
    </>
  );
}
