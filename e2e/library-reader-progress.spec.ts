import { expect, test } from "@playwright/test";
import { jsPDF } from "jspdf";

test("E2E-W-READER-001 opens a library book and persists page progress", async ({ page }) => {
  const title = `E2E Reader ${Date.now()}`;
  const bookId = `e2e-${Date.now()}`;
  const pdf = new jsPDF();
  pdf.text("Paperlike first page", 20, 20);
  pdf.addPage();
  pdf.text("Paperlike second page", 20, 20);
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
  await expect(
    page.getByRole("heading", { name: /Kütüphanen boş|Your library is empty/i })
  ).toBeVisible();
  await page.evaluate(
    async ({ seededBook, bytes }) => {
      localStorage.setItem(
        "onboarding",
        JSON.stringify({ state: { seenReaderTutorial: true }, version: 0 })
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

  const bookLink = page.getByRole("link").filter({ hasText: title });
  await expect(bookLink).toBeVisible();
  await bookLink.click();
  await expect(page).toHaveURL(new RegExp(`/reader\\?bookId=${bookId}`));

  await expect(
    page.getByRole("button", { name: /Uzaklaştır|Zoom out/i })
  ).toBeVisible({ timeout: 30_000 });

  const storedLocation = () =>
    page.evaluate(async (id) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("epub-reader", 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction("progress", "readonly");
      const record = await new Promise<{ location?: string } | undefined>((resolve, reject) => {
        const request = tx.objectStore("progress").get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return record?.location;
    }, bookId);

  // The surface shell is visible before pdf.js finishes discovering the page
  // count. Waiting for page:1 makes the following page-turn deterministic.
  await expect.poll(storedLocation, { timeout: 15_000 }).toBe("page:1");
  await page.keyboard.press("ArrowRight");
  await expect.poll(storedLocation, { timeout: 15_000 }).toBe("page:2");

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(bookLink).toBeVisible();
});
