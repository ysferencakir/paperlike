"use client";

import { useState } from "react";
import {
  Bookmark as BookmarkIcon,
  Download,
  FileText,
  PenLine,
  Star,
  Trash2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Book, Bookmark, Highlight, ImportanceLevel } from "@/lib/types";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";
import { exportHighlightsToPdf, exportHighlightsToWord } from "@/lib/export-notes";

export function NotesPanel({
  open,
  onOpenChange,
  book,
  highlights,
  bookmarks,
  onNavigate,
  onDeleteHighlight,
  onUpdateNote,
  onUpdateImportance,
  onDeleteBookmark,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  book: Book;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  onNavigate: (location: string) => void;
  onDeleteHighlight: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateImportance: (id: string, importance: ImportanceLevel) => void;
  onDeleteBookmark: (id: string) => void;
}) {
  const [tab, setTab] = useState<"highlights" | "bookmarks">("highlights");
  const [editing, setEditing] = useState<Highlight | null>(null);

  const handleExport = async (format: "word" | "pdf") => {
    try {
      if (format === "word") await exportHighlightsToWord(book, highlights);
      else exportHighlightsToPdf(book, highlights);
    } catch {
      toast.error("Dışa aktarma başarısız oldu.");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="gap-0 border-none bg-popover/95 px-0 pb-6 pt-3 shadow-2xl backdrop-blur-xl"
        >
          <SheetHeader className="flex-row items-center justify-between gap-2 px-5 pb-3 space-y-0">
            <SheetTitle className="text-[15px]">Notlarım</SheetTitle>
            {tab === "highlights" && highlights.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Dışa aktar" />
                  }
                >
                  <Download className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleExport("word")}>
                    <FileText />
                    Word olarak indir (.docx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleExport("pdf")}>
                    <FileText />
                    PDF olarak indir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SheetHeader>

          <div className="px-5 pb-3">
            <ToggleGroup
              value={[tab]}
              onValueChange={(v) => {
                const next = v[0] as typeof tab | undefined;
                if (next) setTab(next);
              }}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="highlights" className="flex-1">
                Vurgular ({highlights.length})
              </ToggleGroupItem>
              <ToggleGroupItem value="bookmarks" className="flex-1">
                Yer İmleri ({bookmarks.length})
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-1.5 overflow-y-auto px-3">
            {tab === "highlights" &&
              (highlights.length === 0 ? (
                <EmptyState text="Henüz vurgu yok. Metni seçip renk ve önem seçerek vurgulayabilirsin." />
              ) : (
                highlights.map((h) => (
                  <div
                    key={h.id}
                    className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-border"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate(h.location)}
                      className="flex flex-col gap-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {h.importance > 0 && (
                          <span className="flex items-center gap-0.5">
                            {Array.from({ length: h.importance }).map((_, i) => (
                              <Star key={i} className="size-3 fill-amber-400 text-amber-500" />
                            ))}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(h.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                      </div>

                      <blockquote
                        className="border-l-[3px] pl-3 font-reader-serif text-[13.5px] italic leading-relaxed text-foreground"
                        style={{ borderColor: h.color }}
                      >
                        &ldquo;{h.text}&rdquo;
                      </blockquote>

                      {h.note && (
                        <p className="rounded-lg bg-muted/60 px-2.5 py-2 text-[12px] not-italic leading-snug text-foreground">
                          {h.note}
                        </p>
                      )}
                    </button>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        {([1, 2, 3] as ImportanceLevel[]).map((level) => (
                          <button
                            key={level}
                            type="button"
                            aria-label={`Önem seviyesi ${level}`}
                            onClick={() =>
                              onUpdateImportance(h.id, h.importance === level ? 0 : level)
                            }
                            className="flex size-5 items-center justify-center text-muted-foreground/50 opacity-0 transition-opacity hover:text-amber-500 group-hover:opacity-100"
                          >
                            <Star
                              className={cn(
                                "size-3.5",
                                h.importance >= level && "fill-amber-400 text-amber-500 opacity-100"
                              )}
                            />
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Not düzenle"
                          onClick={() => setEditing(h)}
                          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          <PenLine className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Vurguyu sil"
                          onClick={() => onDeleteHighlight(h.id)}
                          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ))}

            {tab === "bookmarks" &&
              (bookmarks.length === 0 ? (
                <EmptyState text="Henüz yer imi yok. Üstteki yer imi simgesine dokunarak ekleyebilirsin." />
              ) : (
                bookmarks.map((b) => (
                  <div
                    key={b.id}
                    className="group flex items-center gap-2.5 rounded-xl px-2 py-2.5 hover:bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate(b.location)}
                      className="flex flex-1 items-center gap-2.5 text-left"
                    >
                      <BookmarkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-1 text-[13px] text-foreground">
                        {b.label || "Konum"}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Yer imini sil"
                      onClick={() => onDeleteBookmark(b.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              ))}
          </div>
        </SheetContent>
      </Sheet>

      <NoteDialog
        key={editing?.id ?? "none"}
        highlight={editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSave={(note) => {
          if (editing) onUpdateNote(editing.id, note);
          setEditing(null);
        }}
      />
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">{text}</p>;
}

function NoteDialog({
  highlight,
  onOpenChange,
  onSave,
}: {
  highlight: Highlight | null;
  onOpenChange: (value: boolean) => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(highlight?.note ?? "");

  return (
    <Dialog open={!!highlight} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Not</DialogTitle>
        </DialogHeader>
        {highlight && (
          <blockquote
            className="border-l-[3px] pl-3 font-reader-serif text-[13px] italic leading-relaxed text-muted-foreground"
            style={{ borderColor: highlight.color }}
          >
            &ldquo;{highlight.text}&rdquo;
          </blockquote>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Bu vurgu hakkında not ekle…"
          className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button onClick={() => onSave(note.trim())}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
