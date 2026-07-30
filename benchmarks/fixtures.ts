import { jsPDF } from "jspdf";
import JSZip from "jszip";

export type BenchmarkProfileName = "small" | "medium" | "large";

export interface BenchmarkProfile {
  pdfPages: number;
  epubChapters: number;
  epubWordsPerChapter: number;
}

export interface BenchmarkFixture {
  name: string;
  mimeType: string;
  title: string;
  bytes: Buffer;
  itemCount: number;
}

export const BENCHMARK_PROFILES: Record<BenchmarkProfileName, BenchmarkProfile> = {
  small: { pdfPages: 12, epubChapters: 8, epubWordsPerChapter: 500 },
  medium: { pdfPages: 120, epubChapters: 60, epubWordsPerChapter: 2_000 },
  large: { pdfPages: 600, epubChapters: 240, epubWordsPerChapter: 8_000 },
};

export function resolveBenchmarkProfile(value: string | undefined): BenchmarkProfileName {
  return value === "small" || value === "large" ? value : "medium";
}

export function createPdfFixture(profileName: BenchmarkProfileName): BenchmarkFixture {
  const profile = BENCHMARK_PROFILES[profileName];
  const title = `Paperlike Benchmark PDF ${profileName}`;
  const pdf = new jsPDF({ compress: true });
  pdf.setProperties({ title, author: "Paperlike Benchmark" });

  for (let pageNumber = 1; pageNumber <= profile.pdfPages; pageNumber++) {
    if (pageNumber > 1) pdf.addPage();
    pdf.setFontSize(16);
    pdf.text(`Paperlike benchmark page ${pageNumber}`, 20, 24);
    pdf.setFontSize(10);
    pdf.text(
      "Deterministic content for import, first-render, virtualization, and search measurements.",
      20,
      34
    );
  }

  return {
    name: `paperlike-benchmark-${profileName}.pdf`,
    mimeType: "application/pdf",
    title,
    bytes: Buffer.from(pdf.output("arraybuffer")),
    itemCount: profile.pdfPages,
  };
}

export async function createEpubFixture(
  profileName: BenchmarkProfileName
): Promise<BenchmarkFixture> {
  const profile = BENCHMARK_PROFILES[profileName];
  const title = `Paperlike Benchmark EPUB ${profileName}`;
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  );

  const manifest: string[] = [];
  const spine: string[] = [];
  const navPoints: string[] = [];
  const words = Array.from(
    { length: profile.epubWordsPerChapter },
    (_, index) => `benchmark${index % 97}`
  ).join(" ");

  for (let chapter = 1; chapter <= profile.epubChapters; chapter++) {
    const id = `chapter-${chapter}`;
    const href = `chapter-${chapter}.xhtml`;
    manifest.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
    navPoints.push(
      `<navPoint id="nav-${chapter}" playOrder="${chapter}"><navLabel><text>Benchmark chapter ${chapter}</text></navLabel><content src="${href}"/></navPoint>`
    );
    zip.file(
      `OEBPS/${href}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${chapter}</title></head>
<body><h1>Paperlike benchmark chapter ${chapter}</h1><p>${words}</p></body></html>`
    );
  }

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="paperlike-benchmark-${profileName}"/></head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>${navPoints.join("\n")}</navMap>
</ncx>`
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">paperlike-benchmark-${profileName}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>Paperlike Benchmark</dc:creator>
    <dc:language>tr</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifest.join("\n")}
  </manifest>
  <spine toc="ncx">${spine.join("\n")}</spine>
</package>`
  );

  return {
    name: `paperlike-benchmark-${profileName}.epub`,
    mimeType: "application/epub+zip",
    title,
    // STORE mirrors the parser compatibility fixture and keeps generation
    // deterministic. The repeated payload still gives each profile a stable
    // uncompressed workload for IndexedDB and backup measurements.
    bytes: await zip.generateAsync({ type: "nodebuffer", compression: "STORE" }),
    itemCount: profile.epubChapters,
  };
}
