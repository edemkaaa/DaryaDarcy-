import { defineConfig } from "@playwright/test";

// The base suite expects the default legacy-video build. Opt-in catalog builds
// use playwright.catalog.config.ts so their API fixtures match the chosen UI.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
