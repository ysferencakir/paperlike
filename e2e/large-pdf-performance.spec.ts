import { expect, test } from "@playwright/test";
import { jsPDF } from "jspdf";

test("E2E-W-PERF-001 virtualizes a large PDF in continuous mode", async ({ page }) => {
  const title = `E2E Large PDF ${Date.now()}`;
  const bookId = `e2e-large-${Date.now()}`;
  const pdf = new jsPDF();
  pdf.text("Paperlike performance page 1", 20, 20);
  for (let pageNumber = 2; pageNumber <= 120; pageNumber++) {
    pdf.addPage();
    pdf.text(`Paperlike performance page ${pageNumber}`, 20, 20);
  }
  const pdfBytes = Array.from(new Uint8Array(pdf.output("arraybuffer")));
  const book = {
    id: bookId,
    title,
    author: "Playwright",
    format: "pdf" as const,
    addedAt: Date.now(),
    fileSize: pdfBytes.length,
  };

  await page.goto("/");
  await page.evaluate(
    async ({ seededBook, bytes }) => {
      localStorage.setItem(
        "onboarding",
        JSON.stringify({ state: { seenReaderTutorial: true }, version: 0 })
      );
      localStorage.setItem(
        "reader-settings",
        JSON.stringify({ state: { scrollMode: true }, version: 0 })
      );

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("epub-reader", 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(["books", "files"], "readwrite");
      tx.objectStore("books").put(seededBook);
      tx.objectStore("files").put({
        bookId: seededBook.id,
        blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { seededBook: book, bytes: pdfBytes }
  );
  await page.reload();

  await page.getByRole("link").filter({ hasText: title }).click();
  await expect(page.getByRole("button", { name: /Uzaklaştır|Zoom out/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[data-pdf-page-slot]")).toHaveCount(120, {
    timeout: 30_000,
  });

  await expect
    .poll(
      () => page.locator("[data-pdf-page-slot] .react-pdf__Page").count(),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0);

  const renderedPageCount = await page
    .locator("[data-pdf-page-slot] .react-pdf__Page")
    .count();
  expect(renderedPageCount).toBeLessThanOrEqual(10);
  await expect(
    page.locator('[data-pdf-page-slot="100"] .react-pdf__Page')
  ).toHaveCount(0);

  await page.getByRole("button", { name: /Kitapta ara|Search in book/i }).click();
  await page.getByPlaceholder(/Ara|Search/i).fill("performance page 100");
  await expect(
    page.getByRole("button", { name: /Paperlike performance page 100/i })
  ).toBeVisible({ timeout: 30_000 });
});
