import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Match a Prodamus TEST build, including recovery flags to check TEST priority.
process.env.PRODAMUS_RETURN_UI_ENABLED = "true";
process.env.GUEST_CHECKOUT_UI_ENABLED = "false";
process.env.NORMAL_CHECKOUT_UI_ENABLED = "false";

export default defineConfig({
  ...base,
  testMatch: ["prodamus-return.spec.ts"],
  outputDir: "test-results/prodamus-test",
});
