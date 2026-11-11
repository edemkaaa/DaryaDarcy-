/** Изолированный runner передаёт адрес настоящего временного API/frontend через fixture; конфигурация не использует рабочий стенд по умолчанию. */
import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const file = process.env.DARYADARCY_EDITOR_FIXTURE_FILE;
if (!file)
  throw new Error("Run pnpm test:editors:real to prepare the isolated API.");
const fixture = JSON.parse(readFileSync(file, "utf8")) as { origin: string };

export default defineConfig({
  ...base,
  testMatch: ["real-content-editors.spec.ts"],
  maxFailures: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json"]],
  outputDir: "test-results/real-editors/artifacts",
  use: { ...base.use, baseURL: fixture.origin },
  webServer: undefined,
});
