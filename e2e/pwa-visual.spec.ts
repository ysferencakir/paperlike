import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

type FakePwaMode = "normal" | "installed" | "update" | "cache-error";

async function installDeterministicBrowserState(page: Page, mode: FakePwaMode) {
  await page.addInitScript(({ selectedMode }) => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const result = nativeMatchMedia(query);
      if (query === "(display-mode: standalone)" && selectedMode === "installed") {
        Object.defineProperty(result, "matches", { configurable: true, value: true });
      }
      return result;
    };

    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: async () => ({
          usage: 128 * 1024 * 1024,
          quota: 1024 * 1024 * 1024,
        }),
        persisted: async () => false,
        persist: async () => false,
      },
    });

    if (selectedMode === "normal" || selectedMode === "installed") return;

    class FakeWorker extends EventTarget {
      state = "installed";
      postMessage() {}
    }
    class FakeRegistration extends EventTarget {
      installing = null;
      waiting = selectedMode === "update" ? new FakeWorker() : null;
      async update() {}
    }
    class FakeServiceWorkerContainer extends EventTarget {
      controller = new FakeWorker();
      registration = new FakeRegistration();
      async register() {
        if (selectedMode === "cache-error") {
          window.setTimeout(() => {
            this.dispatchEvent(
              new MessageEvent("message", { data: { type: "PWA_CACHE_ERROR" } })
            );
          }, 250);
        }
        return this.registration;
      }
    }
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: new FakeServiceWorkerContainer(),
    });
  }, { selectedMode: mode });
}

async function stabilize(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}",
  });
  await page.evaluate(() => document.fonts.ready);
}

async function assertViewportIntegrity(page: Page) {
  const metrics = await page.evaluate(() => ({
    horizontalOverflow:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyHeight: document.body.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
  }));
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(metrics.bodyHeight).toBeGreaterThanOrEqual(metrics.viewportHeight);
}

async function captureReference(page: Page, testInfo: TestInfo, name: string) {
  const filename = `${testInfo.project.name}-${name}.png`;
  const updateReferences = process.env.UPDATE_VISUAL_REFERENCES === "1";
  const path = updateReferences
    ? resolve(process.cwd(), "docs", "visual-references", filename)
    : testInfo.outputPath(filename);
  await mkdir(resolve(path, ".."), { recursive: true });
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
}

test("VIS-PWA-001 empty library shell", async ({ page }, testInfo) => {
  await installDeterministicBrowserState(page, "normal");
  await page.goto("/");
  await stabilize(page);

  await expect(
    page.getByRole("heading", { name: /Kütüphanen boş|Your library is empty/i })
  ).toBeVisible();
  await assertViewportIntegrity(page);
  await captureReference(page, testInfo, "library-empty");
});

test("VIS-PWA-002 installed app and storage panel", async ({ page }, testInfo) => {
  await installDeterministicBrowserState(page, "installed");
  await page.goto("/");
  await page.getByRole("button", { name: /Uygulama ve depolama|App and storage/i }).click();
  await stabilize(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(/Paperlike bu cihazda yüklü|Paperlike is installed/i);
  await expect(dialog).toContainText(/128 MB.*1 GB|128 MB.*1 GB/i);
  await expect(dialog).toBeInViewport();
  await assertViewportIntegrity(page);
  await captureReference(page, testInfo, "installed-storage");
});

test("VIS-PWA-003 update ready banner", async ({ page }, testInfo) => {
  await installDeterministicBrowserState(page, "update");
  await page.goto("/");
  await stabilize(page);

  await expect(page.getByRole("status")).toContainText(
    /Paperlike'ın yeni sürümü hazır|A new version of Paperlike is ready/i
  );
  await expect(page.getByRole("button", { name: /Güncelle|Update/i })).toBeInViewport();
  await assertViewportIntegrity(page);
  await captureReference(page, testInfo, "update-ready");
});

test("VIS-PWA-004 cache failure preserves the library", async ({ page }, testInfo) => {
  await installDeterministicBrowserState(page, "cache-error");
  await page.goto("/");
  await stabilize(page);

  await expect(page.getByText(/Mevcut verilerin korunuyor|existing data is preserved/i))
    .toBeVisible();
  await expect(page.getByText(/Kütüphanem|My Library/i).first()).toBeVisible();
  await assertViewportIntegrity(page);
  await captureReference(page, testInfo, "cache-error");
});

test("VIS-PWA-005 offline app shell", async ({ context, page }, testInfo) => {
  await installDeterministicBrowserState(page, "normal");
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  await context.setOffline(true);
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await stabilize(page);
    await expect(page.getByText(/Kütüphanem|My Library/i).first()).toBeVisible();
    await assertViewportIntegrity(page);
    await captureReference(page, testInfo, "offline");
  } finally {
    await context.setOffline(false);
  }
});
