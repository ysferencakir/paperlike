import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(1);
}

test("E2E-W-RESP-001 keeps empty-library actions reachable across responsive profiles", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Kütüphanen boş|Your library is empty/i })
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: /Hesap|Account/i })
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: /Yedekleme|Backup/i })
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: /Uygulama ve depolama|App and storage/i })
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: /EPUB veya PDF yükleyin|Upload an EPUB or PDF/i })
  ).toBeInViewport();
  await expectNoHorizontalOverflow(page);
});

test("E2E-W-RESP-002 keeps an open dialog usable after an orientation change", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: /Uygulama ve depolama|App and storage/i,
  });
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeInViewport();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  await page.setViewportSize({
    width: viewport!.height,
    height: viewport!.width,
  });

  await expect(dialog).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
