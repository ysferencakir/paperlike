import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.A11Y_BASE_URL;
const devMode = process.env.A11Y_DEV === "1";
const baseURL =
  externalBaseURL ?? (devMode ? "http://127.0.0.1:3101" : "http://127.0.0.1:3100");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "accessibility.spec.ts",
  fullyParallel: false,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never", outputFolder: "playwright-report/a11y" }], ["github"]]
    : "list",
  globalSetup: devMode || externalBaseURL ? undefined : "./e2e/global-setup.ts",
  webServer: devMode && !externalBaseURL
    ? {
        command: "npm run dev -- -H 127.0.0.1 -p 3101",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    locale: "tr-TR",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
