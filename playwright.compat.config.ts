import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "browser-compat.spec.ts",
  fullyParallel: true,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never", outputFolder: "playwright-report/compat" }], ["github"]]
    : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
