import { pdfjs } from "react-pdf";

let workerConfigured = false;

export function ensurePdfWorker() {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
}

export interface ParsedPdf {
  title: string;
  author: string;
  coverBlob?: Blob;
}

export async function parsePdfFile(file: Blob, fallbackTitle: string): Promise<ParsedPdf> {
  ensurePdfWorker();
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  let title = fallbackTitle;
  let author = "Bilinmeyen Yazar";
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string; Author?: string };
    if (info?.Title?.trim()) title = info.Title.trim();
    if (info?.Author?.trim()) author = info.Author.trim();
  } catch {
    // metadata is optional
  }

  let coverBlob: Blob | undefined;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 0.6 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      coverBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      ) ?? undefined;
    }
  } catch {
    coverBlob = undefined;
  }

  await doc.destroy();
  return { title, author, coverBlob };
}
