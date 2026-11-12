/** Адрес берётся из специально подготовленного checkout fixture; собственный webServer не запускаем и прекращаем прогон после первого отказа. */
import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

const file = process.env.DARYADARCY_EDITOR_FIXTURE_FILE;
if (!file)
  throw new Error("Run pnpm test:checkout:real to prepare the isolated API.");
const fixture = JSON.parse(readFileSync(file, "utf8")) as {
  origin: string;
  profile: string;
};
if (fixture.profile !== "checkout")
  throw new Error("NORMAL/GUEST fixture required");
export default defineConfig({
  ...base,
  testMatch: ["real-checkout.spec.ts"],
  maxFailures: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json"]],
  outputDir: "../../test-results/real-checkout/artifacts",
  use: { ...base.use, baseURL: fixture.origin },
  webServer: undefined,
});
