import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";

const root = resolve(__dirname, "../..");
const buildRoot = process.env.CACHE_AUDIT_WORKSPACE ?? root;
export default defineConfig({
  ...base,
  testMatch: ["full-cache-audit.spec.ts"],
  timeout: 45_000,
  outputDir: process.env.CACHE_AUDIT_OUTPUT ?? "../../tmp/cache-audit-results",
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          process.env.CACHE_AUDIT_REPORT ??
          resolve(root, "tmp/cache-audit-report.json"),
      },
    ],
  ],
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:19092",
    launchOptions: {
      ...base.use?.launchOptions,
      args: [
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
      ],
    },
  },
  webServer: [
    {
      command:
        "node node_modules/next/dist/bin/next start apps/frontend --hostname 127.0.0.1 --port 18081",
      cwd: buildRoot,
      url: "http://127.0.0.1:18081",
      reuseExistingServer: false,
      timeout: 30_000,
      env: { NEXT_TELEMETRY_DISABLED: "1" },
    },
    {
      command: "node apps/frontend/e2e/fixtures/cache-audit-proxy.mjs",
      cwd: root,
      url: "http://127.0.0.1:19092/api/capabilities",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
