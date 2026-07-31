import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

async function expectNoAutomaticWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS])
    .analyze();
  expect(
    results.violations,
    results.violations
      .map((violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary}`)
          .join("\n")}`
      )
      .join("\n\n")
  ).toEqual([]);
}

test("E2E-W-A11Y-001 empty library meets automated WCAG A/AA checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Kütüphanen boş|Your library is empty/i })
  ).toBeVisible();
  await expectNoAutomaticWcagViolations(page);
});

test("E2E-W-A11Y-002 storage dialog traps focus and returns it to the trigger", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: /Uygulama ve depolama|App and storage/i,
  });
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toBeVisible();
  await expectNoAutomaticWcagViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("E2E-W-A11Y-003 upload dropzone is keyboard operable", async ({ page }) => {
  await page.goto("/");
  const upload = page.getByRole("button", {
    name: /EPUB veya PDF yükleyin|Upload an EPUB or PDF/i,
  });
  await upload.focus();

  const chooserPromise = page.waitForEvent("filechooser");
  await upload.press("Enter");
  await chooserPromise;

  await expect(upload).toBeFocused();
});

test("E2E-W-A11Y-004 library reflows at 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(layout.content - layout.viewport).toBeLessThanOrEqual(1);
  await expect(
    page.getByRole("heading", { name: /Kütüphanen boş|Your library is empty/i })
  ).toBeInViewport();
  await expectNoAutomaticWcagViolations(page);
});
