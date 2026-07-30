import { readFile } from "node:fs/promises";
import os from "node:os";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  BENCHMARK_PROFILES,
  createEpubFixture,
  createPdfFixture,
  resolveBenchmarkProfile,
  type BenchmarkFixture,
} from "./fixtures";
import {
  createMetricResult,
  writeBenchmarkReport,
  type BenchmarkMetricDefinition,
} from "./report";

const TIMING_BUDGETS: BenchmarkMetricDefinition[] = [
  { id: "pdf_import_ms", label: "PDF import", unit: "ms", kind: "timing", budget: 15_000 },
  { id: "epub_import_ms", label: "EPUB import", unit: "ms", kind: "timing", budget: 15_000 },
  {
    id: "pdf_first_page_ms",
    label: "PDF reader first page",
    unit: "ms",
    kind: "timing",
    budget: 10_000,
  },
  {
    id: "pdf_page_turn_ms",
    label: "PDF page turn persistence",
    unit: "ms",
    kind: "timing",
    budget: 5_000,
  },
  { id: "pdf_search_ms", label: "PDF search", unit: "ms", kind: "timing", budget: 15_000 },
  {
    id: "backup_export_ms",
    label: "Backup export",
    unit: "ms",
    kind: "timing",
    budget: 15_000,
  },
  {
    id: "backup_restore_ms",
    label: "Backup restore",
    unit: "ms",
    kind: "timing",
    budget: 20_000,
  },
];

const STRUCTURAL_BUDGETS: BenchmarkMetricDefinition[] = [
  {
    id: "active_pdf_pages",
    label: "Simultaneously rendered PDF pages",
    unit: "count",
    kind: "structural",
    budget: 10,
  },
  {
    id: "cover_cache_miss_after_view_switch",
    label: "New cover object URLs after view switch",
    unit: "count",
    kind: "structural",
    budget: 0,
  },
  {
    id: "cover_thumbnail_width",
    label: "Cached cover natural width",
    unit: "count",
    kind: "structural",
    budget: 384,
  },
  {
    id: "cover_thumbnail_height",
    label: "Cached cover natural height",
    unit: "count",
    kind: "structural",
    budget: 576,
  },
];

type SampleMap = Record<string, number[]>;

test("PERF-W-001 measures the critical large-book workflow", async ({ browser }) => {
  const profileName = resolveBenchmarkProfile(process.env.BENCHMARK_PROFILE);
  const profile = BENCHMARK_PROFILES[profileName];
  const iterations = parseIterations(process.env.BENCHMARK_ITERATIONS);
  const timingsEnforced = process.env.BENCHMARK_ENFORCE_TIMINGS === "1";
  const pdf = createPdfFixture(profileName);
  const epub = await createEpubFixture(profileName);
  const samples: SampleMap = Object.fromEntries(
    [...TIMING_BUDGETS, ...STRUCTURAL_BUDGETS].map(({ id }) => [id, []])
  );

  for (let iteration = 0; iteration < iterations; iteration++) {
    console.log(`[benchmark] iteration ${iteration + 1}/${iterations}: prepare`);
    const context = await browser.newContext({ acceptDownloads: true });
    try {
      const page = await preparePage(context);
      console.log(`[benchmark] iteration ${iteration + 1}: import PDF`);
      samples.pdf_import_ms.push(await importFixture(page, pdf));
      console.log(`[benchmark] iteration ${iteration + 1}: import EPUB`);
      samples.epub_import_ms.push(await importFixture(page, epub));

      console.log(`[benchmark] iteration ${iteration + 1}: first PDF page`);
      const firstPageStart = performance.now();
      await page.getByRole("link").filter({ hasText: pdf.title }).click();
      await expect(page.getByRole("button", { name: /Uzaklaştır|Zoom out/i })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("[data-pdf-page-slot]")).toHaveCount(profile.pdfPages, {
        timeout: 30_000,
      });
      await expect.poll(() => storedLocation(page)).toBe("page:1");
      samples.pdf_first_page_ms.push(performance.now() - firstPageStart);

      const activePdfPages = await page
        .locator("[data-pdf-page-slot] .react-pdf__Page")
        .count();
      samples.active_pdf_pages.push(activePdfPages);

      const pageTurnStart = performance.now();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => storedLocation(page)).toBe("page:2");
      samples.pdf_page_turn_ms.push(performance.now() - pageTurnStart);

      const targetPage = Math.min(profile.pdfPages, 100);
      console.log(`[benchmark] iteration ${iteration + 1}: PDF search`);
      const searchStart = performance.now();
      await page.getByRole("button", { name: /Kitapta ara|Search in book/i }).click();
      await page.getByPlaceholder(/Ara|Search/i).fill(`benchmark page ${targetPage}`);
      await expect(
        page.getByRole("button", {
          name: new RegExp(`Paperlike benchmark page ${targetPage}`, "i"),
        })
      ).toBeVisible({ timeout: 30_000 });
      samples.pdf_search_ms.push(performance.now() - searchStart);

      await page.goto("/");
      console.log(`[benchmark] iteration ${iteration + 1}: cover cache`);
      await instrumentObjectUrls(page);
      await expect(page.getByRole("img", { name: pdf.title })).toBeVisible({
        timeout: 15_000,
      });
      const thumbnailDimensions = await page
        .getByRole("img", { name: pdf.title })
        .evaluate((image: HTMLImageElement) => ({
          width: image.naturalWidth,
          height: image.naturalHeight,
        }));
      samples.cover_thumbnail_width.push(thumbnailDimensions.width);
      samples.cover_thumbnail_height.push(thumbnailDimensions.height);
      await page.evaluate(() => window.__paperlikeBenchmark?.reset());
      for (const viewName of [/Liste görünümü|List view/i, /Raf görünümü|Shelf view/i]) {
        await page.getByRole("button", { name: viewName }).click();
        await expect(page.getByRole("img", { name: pdf.title })).toBeVisible({
          timeout: 15_000,
        });
      }
      const coverObjectUrls = await page.evaluate(
        () => window.__paperlikeBenchmark?.createdObjectUrls ?? -1
      );
      samples.cover_cache_miss_after_view_switch.push(coverObjectUrls);

      console.log(`[benchmark] iteration ${iteration + 1}: backup export`);
      const exportStart = performance.now();
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: /Yedekleme|Backup/i }).click();
      await page.getByText(/Kütüphaneyi Yedekle|Back Up Library/i).click();
      const download = await downloadPromise;
      const backupPath = await download.path();
      if (!backupPath) throw new Error("Benchmark backup download did not produce a file.");
      const backupBytes = await readFile(backupPath);
      samples.backup_export_ms.push(performance.now() - exportStart);

      await clearLibrary(page);
      await expect(page.getByRole("link").filter({ hasText: pdf.title })).toHaveCount(0);

      console.log(`[benchmark] iteration ${iteration + 1}: backup restore`);
      const restoreStart = performance.now();
      await page
        .locator('input[type="file"][accept*=".zip"]')
        .setInputFiles({
          name: "paperlike-benchmark-backup.zip",
          mimeType: "application/zip",
          buffer: backupBytes,
        });
      await expect(page.getByRole("link").filter({ hasText: pdf.title })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole("link").filter({ hasText: epub.title })).toBeVisible();
      samples.backup_restore_ms.push(performance.now() - restoreStart);
    } finally {
      await context.close();
    }
  }

  const metrics = [...TIMING_BUDGETS, ...STRUCTURAL_BUDGETS].map((definition) =>
    createMetricResult(definition, samples[definition.id], timingsEnforced)
  );
  console.log("[benchmark] writing JSON and Markdown reports");
  await writeBenchmarkReport({
    schemaVersion: 1,
    suite: "paperlike-reader",
    platform: "web",
    profile: profileName,
    generatedAt: new Date().toISOString(),
    iterations,
    timingsEnforced,
    environment: {
      ci: Boolean(process.env.CI),
      node: process.version,
      os: `${os.platform()} ${os.release()}`,
      architecture: os.arch(),
      browser: `Chromium ${browser.version()}`,
      commit: process.env.GITHUB_SHA,
    },
    fixtures: {
      pdf: { bytes: pdf.bytes.length, itemCount: pdf.itemCount, mimeType: pdf.mimeType },
      epub: { bytes: epub.bytes.length, itemCount: epub.itemCount, mimeType: epub.mimeType },
    },
    metrics,
  });

  for (const metric of metrics.filter(({ status }) => status === "fail")) {
    expect(
      metric.p95,
      `${metric.id} exceeded its ${metric.budget} ${metric.unit} budget`
    ).toBeLessThanOrEqual(metric.budget);
  }
});

async function preparePage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "onboarding",
      JSON.stringify({ state: { seenReaderTutorial: true }, version: 0 })
    );
    localStorage.setItem(
      "reader-settings",
      JSON.stringify({ state: { scrollMode: true }, version: 0 })
    );
    localStorage.setItem(
      "library-view",
      JSON.stringify({ state: { viewMode: "grid" }, version: 0 })
    );
  });
  await page.reload();
  return page;
}

async function instrumentObjectUrls(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__paperlikeBenchmark) return;
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    let createdObjectUrls = 0;
    let revokedObjectUrls = 0;

    URL.createObjectURL = (object: Blob | MediaSource) => {
      createdObjectUrls += 1;
      return originalCreate(object);
    };
    URL.revokeObjectURL = (url: string) => {
      revokedObjectUrls += 1;
      originalRevoke(url);
    };
    window.__paperlikeBenchmark = {
      get createdObjectUrls() {
        return createdObjectUrls;
      },
      get revokedObjectUrls() {
        return revokedObjectUrls;
      },
      reset() {
        createdObjectUrls = 0;
        revokedObjectUrls = 0;
      },
    };
  });
}

async function importFixture(page: Page, fixture: BenchmarkFixture): Promise<number> {
  const startedAt = performance.now();
  const input = page.locator('input[type="file"][accept*=".epub"]');
  if ((await input.count()) === 0) {
    await page.getByRole("button", { name: /Kitap Ekle|Add Book/i }).click();
  }
  await input.setInputFiles({
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: fixture.bytes,
  });
  await expect(page.getByRole("link").filter({ hasText: fixture.title })).toBeVisible({
    timeout: 30_000,
  });
  return performance.now() - startedAt;
}

async function storedLocation(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("epub-reader", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("progress", "readonly");
    const records = await new Promise<Array<{ location?: string }>>((resolve, reject) => {
      const request = tx.objectStore("progress").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return records[0]?.location;
  });
}

async function clearLibrary(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("epub-reader", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const storeNames = Array.from(db.objectStoreNames);
    const tx = db.transaction(storeNames, "readwrite");
    for (const storeName of storeNames) tx.objectStore(storeName).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
}

function parseIterations(rawValue: string | undefined): number {
  if (!rawValue) return process.env.CI ? 1 : 3;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10) : 1;
}

declare global {
  interface Window {
    __paperlikeBenchmark?: {
      readonly createdObjectUrls: number;
      readonly revokedObjectUrls: number;
      reset(): void;
    };
  }
}
