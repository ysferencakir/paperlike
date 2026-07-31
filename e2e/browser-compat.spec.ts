import { expect, test } from "@playwright/test";

test("E2E-W-COMPAT-001 keeps the library usable without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/Kütüphanem|My Library/i).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Kütüphanen boş|Your library is empty/i })
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: /Uygulama ve depolama|App and storage/i }).click();
  await expect(page.getByRole("dialog")).toContainText(
    /Uygulama ve Depolama|App and Storage/i
  );
  await expect(page.getByRole("dialog")).toBeInViewport();
});
