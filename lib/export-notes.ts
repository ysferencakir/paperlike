import type { Book, Highlight } from "./types";
import { IMPORTANCE_KEYS } from "./types";
import type { Translate } from "./i18n/useTranslation";
import type { Paragraph as DocxParagraph } from "docx";

function sortedByCreatedAt(highlights: Highlight[]): Highlight[] {
  return [...highlights].sort((a, b) => a.createdAt - b.createdAt);
}

function safeFileName(name: string, t: Translate): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || t("exportNotes.defaultBookName");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportHighlightsToWord(
  book: Book,
  highlights: Highlight[],
  t: Translate
): Promise<void> {
  // Loaded on demand — docx is only needed for this one rarely-used export
  // action, not worth carrying in every route that can reach NotesPanel.
  const { BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const items = sortedByCreatedAt(highlights);

  const children: DocxParagraph[] = [
    new Paragraph({ text: book.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      spacing: { after: 400 },
      children: [new TextRun({ text: book.author, italics: true, color: "6b6b6b" })],
    }),
  ];

  items.forEach((h, i) => {
    const meta = [`${i + 1}.`];
    if (h.importance > 0) meta.push(t(IMPORTANCE_KEYS[h.importance]));

    children.push(
      new Paragraph({
        spacing: { before: 320, after: 60 },
        children: [
          new TextRun({ text: meta.join(" "), bold: true, color: "8a8a8a", size: 18 }),
        ],
      }),
      new Paragraph({
        indent: { left: 360 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 18, space: 8, color: h.color.replace("#", "") },
        },
        children: [new TextRun({ text: `“${h.text}”`, italics: true })],
      })
    );

    if (h.note) {
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 80 },
          children: [new TextRun({ text: h.note })],
        })
      );
    }
  });

  if (items.length === 0) {
    children.push(new Paragraph({ text: t("exportNotes.noHighlights") }));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, t("exportNotes.wordFilename", { title: safeFileName(book.title, t) }));
}

export async function exportHighlightsToPdf(
  book: Book,
  highlights: Highlight[],
  t: Translate
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const items = sortedByCreatedAt(highlights);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2 - 14;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(book.title, margin, y);
  y += 22;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(107, 107, 107);
  doc.text(book.author, margin, y);
  doc.setTextColor(20, 20, 20);
  y += 32;

  if (items.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(t("exportNotes.noHighlights"), margin, y);
  }

  items.forEach((h, i) => {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    const label = h.importance > 0 ? `${i + 1}.  ${t(IMPORTANCE_KEYS[h.importance])}` : `${i + 1}.`;
    doc.text(label.toUpperCase(), margin + 14, y);
    doc.setTextColor(20, 20, 20);
    y += 14;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    const quoteLines: string[] = doc.splitTextToSize(`“${h.text}”`, maxWidth);
    ensureSpace(quoteLines.length * 15);
    doc.setFillColor(h.color);
    doc.rect(margin, y - 10, 3, quoteLines.length * 15, "F");
    doc.text(quoteLines, margin + 14, y);
    y += quoteLines.length * 15 + 2;

    if (h.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const noteLines: string[] = doc.splitTextToSize(h.note, maxWidth);
      ensureSpace(noteLines.length * 13);
      doc.text(noteLines, margin + 14, y);
      y += noteLines.length * 13;
    }

    y += 18;
  });

  doc.save(t("exportNotes.pdfFilename", { title: safeFileName(book.title, t) }));
}
