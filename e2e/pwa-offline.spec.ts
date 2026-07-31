import { expect, test } from "@playwright/test";

test("E2E-W-PWA-001 installs a service worker and serves the library offline", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/Kütüphanem|My Library/i).first()).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe("/manifest.webmanifest");

  await context.setOffline(true);
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Kütüphanem|My Library/i).first()).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("E2E-W-PWA-002 exposes install guidance and local storage health", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Uygulama ve depolama" }).click();

  await expect(page.getByRole("dialog")).toContainText("Uygulama ve Depolama");
  await expect(page.getByRole("dialog")).toContainText("Uygulamayı yükle");
  await expect(page.getByRole("dialog")).toContainText("Yerel depolama");
  await expect(page.getByLabel("Yerel depolama kullanımı")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("bir yedek değildir");
});

test("E2E-W-PWA-003 activates only a complete app-shell cache", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  const cacheState = await page.evaluate(async () => {
    const names = await caches.keys();
    const activeName = names.find(
      (name) => name.startsWith("paperlike-shell-") && !name.endsWith("-staging")
    );
    const active = activeName ? await caches.open(activeName) : null;
    const required = [
      "/",
      "/reader",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/pdf.worker.min.mjs",
      "/icons/paperlike.svg",
      "/icons/paperlike-maskable.svg",
    ];
    return {
      names,
      activeName,
      complete: active
        ? (await Promise.all(required.map((path) => active.match(path)))).every(Boolean)
        : false,
    };
  });

  expect(cacheState.activeName).toBe("paperlike-shell-v3");
  expect(cacheState.names).not.toContain("paperlike-shell-v3-staging");
  expect(cacheState.complete).toBe(true);
  await expect(page.getByText(/Kütüphanem|My Library/i).first()).toBeVisible();
});
