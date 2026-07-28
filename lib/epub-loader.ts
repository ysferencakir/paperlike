import ePub from "epubjs";

export interface ParsedEpub {
  title: string;
  author: string;
  coverBlob?: Blob;
}

export async function parseEpubFile(file: Blob): Promise<ParsedEpub> {
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  await book.ready;

  const metadata = await book.loaded.metadata;
  const title = metadata.title?.trim() || "Adsız Kitap";
  const author = metadata.creator?.trim() || "Bilinmeyen Yazar";

  let coverBlob: Blob | undefined;
  try {
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      const res = await fetch(coverUrl);
      coverBlob = await res.blob();
      URL.revokeObjectURL(coverUrl);
    }
  } catch {
    coverBlob = undefined;
  }

  book.destroy();
  return { title, author, coverBlob };
}
