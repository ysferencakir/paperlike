import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import type { Translate } from "./i18n/useTranslation";
import { parseEpubFile } from "./epub-loader";

const translate = ((key: string) => key) as Translate;

describe("IT-EPUB-PARSE-001 EPUB parser compatibility", () => {
  it("reads metadata from a minimal EPUB with the patched xmldom dependency", async () => {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?>
       <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
         <rootfiles>
           <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
         </rootfiles>
       </container>`
    );
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0" encoding="UTF-8"?>
       <package version="3.0" unique-identifier="book-id"
         xmlns="http://www.idpf.org/2007/opf">
         <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
           <dc:identifier id="book-id">paperlike-test</dc:identifier>
           <dc:title>Patched EPUB</dc:title>
           <dc:creator>Paperlike QA</dc:creator>
           <dc:language>en</dc:language>
         </metadata>
         <manifest>
           <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
         </manifest>
         <spine><itemref idref="chapter"/></spine>
       </package>`
    );
    zip.file(
      "OEBPS/chapter.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
       <html xmlns="http://www.w3.org/1999/xhtml">
         <head><title>Chapter</title></head>
         <body><p>Reader content</p></body>
       </html>`
    );
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const epubBlob = {
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Blob;

    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:paperlike-test");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }

    await expect(parseEpubFile(epubBlob, translate)).resolves.toMatchObject({
      title: "Patched EPUB",
      author: "Paperlike QA",
    });
  });
});
