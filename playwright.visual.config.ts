import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pwa-visual.spec.ts",
  fullyParallel: false,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI
    ? [["html", { open: "never", outputFolder: "playwright-report/visual" }], ["github"]]
    : "list",
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "test-results/visual",
  use: {
    baseURL: "http://127.0.0.1:3100",
    colorScheme: "light",
    locale: "tr-TR",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
