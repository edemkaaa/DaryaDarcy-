import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";

// Actual Nest redirect and browser fragment inheritance. The destination is a
// harmless intercepted document; the real frontend is covered by password-setup E2E.
describe.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "legacy password email navigation",
  () => {
    let app: INestApplication,
      browser: Browser,
      context: BrowserContext,
      base: string,
      frontend: string;
    beforeAll(async () => {
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      const port = (app.getHttpServer().address() as AddressInfo).port;
      base = `http://127.0.0.1:${port}`;
      frontend = `http://localhost:${port}`;
      vi.stubEnv("PUBLIC_APP_URL", frontend);
      vi.stubEnv("PUBLIC_AUTH_URL", "https://unused.example.test");
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      });
    });
    afterEach(async () => {
      await context?.close();
    });
    afterAll(async () => {
      await browser?.close();
      await app?.close();
      vi.unstubAllEnvs();
    });

    it.each(["#token=" + "A".repeat(43), "#token=invalid", ""])(
      "preserves the old fragment through the actual redirect (%s)",
      async (fragment) => {
        context = await browser.newContext();
        const requests: { url: string; referrer?: string }[] = [];
        const statuses: number[] = [];
        const page = await context.newPage();
        page.on("response", (response) => {
          if (response.url() === `${base}/api/auth/password`)
            statuses.push(response.status());
        });
        page.on("request", (request) =>
          requests.push({
            url: request.url(),
            referrer: request.headers().referer,
          }),
        );
        await context.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.origin === frontend && url.pathname === "/password")
            return route.fulfill({
              contentType: "text/html",
              body: "<!doctype html><title>Frontend password destination</title>",
            });
          if (url.origin === base && url.pathname === "/api/auth/password")
            return route.continue();
          return route.abort();
        });
        await page.goto(`${base}/api/auth/password${fragment}`);
        expect(page.url()).toBe(`${frontend}/password${fragment}`);
        expect(statuses).toEqual([303]);
        const destination = requests.find(
          (request) => request.url === `${frontend}/password`,
        );
        expect(destination).toBeDefined();
        expect(destination?.referrer).toBeUndefined();
        expect(
          requests.every(
            (request) =>
              !request.url.includes("#") &&
              !request.url.includes("A".repeat(43)),
          ),
        ).toBe(true);
      },
    );
  },
);
