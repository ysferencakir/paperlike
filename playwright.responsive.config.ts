import { defineConfig } from "@playwright/test";

const sharedTouchContext = {
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "responsive-layout.spec.ts",
  fullyParallel: true,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never", outputFolder: "playwright-report/responsive" }], ["github"]]
    : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone-landscape",
      use: {
        ...sharedTouchContext,
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: "tablet-portrait",
      use: {
        ...sharedTouchContext,
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "tablet-landscape",
      use: {
        ...sharedTouchContext,
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      // Playwright cannot emulate a physical hinge or Android window posture.
      // This deterministic dual-pane-like viewport still catches width/height
      // assumptions before the same UI reaches foldable hardware testing.
      name: "foldable-like-landscape",
      use: {
        ...sharedTouchContext,
        viewport: { width: 717, height: 512 },
      },
    },
  ],
});
