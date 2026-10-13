import { defineConfig } from "@playwright/test";
import acceptance from "./playwright.acceptance.config";

export default defineConfig({
  ...acceptance,
  testMatch: ["tab-music-toggle.spec.ts"],
  outputDir: "test-results/music",
});
