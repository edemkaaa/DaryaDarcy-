/** Опциональный Chromium проверяет корректное завершение перехватов над настоящим loopback HTTP. */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import {
  drainBrowserRoutes,
  removePageRoutes,
  trackRouteHandler,
} from "./helpers/route-drain";

/** Ручной promise-барьер задаёт точный порядок входа/завершения двух запросов без sleep-гонки. */
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Проверяются context-route и page fallback; запуск требует явно выбранный browser executable. */
describe.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "native proxy route drainage",
  () => {
    /** Teardown ждёт быстрый и медленный upstream ответы, не снимая маршруты раньше fulfill и не пропуская запрос в fallback API. */
    it.each(["context", "page-fallback"])(
      "finishes both forwarded responses before removing interception (%s)",
      async (layer) => {
        const slowEntered = barrier(),
          fastEntered = barrier();
        const slowRelease = barrier(),
          fastRelease = barrier(),
          fastFulfilled = barrier();
        let fallbackRequests = 0;
        const server = createServer(async (req, res) => {
          if (req.url === "/upstream/slow") {
            slowEntered.resolve();
            await slowRelease.promise;
          } else if (req.url === "/upstream/fast") {
            fastEntered.resolve();
            await fastRelease.promise;
          } else if (req.url?.startsWith("/api/")) {
            fallbackRequests++;
          }
          res.end("native loopback response");
        });
        await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
        const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const browser = await chromium.launch({
          executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
        });
        const context = await browser.newContext();
        const errors: unknown[] = [];
        const completed: string[] = [];
        try {
          const proxy = trackRouteHandler(async (route) => {
            const suffix = new URL(route.request().url()).pathname.slice(
              "/api".length,
            );
            try {
              const response = await route.fetch({
                url: origin + "/upstream" + suffix,
              });
              await route.fulfill({ response });
              completed.push(suffix);
            } catch (error) {
              errors.push(error);
              throw error;
            } finally {
              if (suffix === "/fast") fastFulfilled.resolve();
            }
          });
          await context.route("**/api/*", proxy.handler);
          const page = await context.newPage();
          if (layer === "page-fallback")
            await page.route("**/api/*", (route) => route.fallback());
          await page.goto(origin);
          const requests = page.evaluate(() =>
            Promise.all([
              fetch("/api/slow").then((response) => response.text()),
              fetch("/api/fast").then((response) => response.text()),
            ]),
          );
          await Promise.all([slowEntered.promise, fastEntered.promise]);
          const teardown = (async () => {
            if (layer === "page-fallback") await removePageRoutes(page, proxy);
            await drainBrowserRoutes(context, proxy);
          })();
          fastRelease.resolve();
          await fastFulfilled.promise;
          // A protocol round trip lets removal reach the browser before the slow reply.
          await context.request.get(origin + "/barrier");
          slowRelease.resolve();
          await teardown;
          expect(await requests).toEqual([
            "native loopback response",
            "native loopback response",
          ]);
          expect(errors).toEqual([]);
          expect(completed.sort()).toEqual(["/fast", "/slow"]);
          expect(fallbackRequests).toBe(0);
        } finally {
          slowRelease.resolve();
          fastRelease.resolve();
          await context.close();
          await browser.close();
          await new Promise<void>((done, reject) =>
            server.close((error) => (error ? reject(error) : done())),
          );
        }
      },
      15_000,
    );
  },
);
