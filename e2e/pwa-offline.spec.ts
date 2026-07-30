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
