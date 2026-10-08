import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
let browser, server, origin;
let mode, calls;
let firstCall, releaseProof, proofGate;

before(async () => {
  const frontend = new URL("../apps/frontend/", import.meta.url).pathname;
  // One bundle shares the real caller, transport and session lifecycle. Only
  // the external HTTP replies are fixtures; no app endpoint or DB is changed.
  const bundle = await build({
    stdin: {
      contents: [
        'export { getClubCheckoutIntent, reserveNextClubCheckoutIntent } from "./src/features/club/checkout-intent";',
        'export { pollClubTestCheckout } from "./src/features/club/checkout-polling";',
        'export { createTRPCClient } from "./src/shared/api/trpc";',
      ].join("\n"),
      resolveDir: frontend,
    },
    tsconfig: `${frontend}tsconfig.json`,
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    define: {
      "process.env.NEXT_PUBLIC_API_BASE_URL": '""',
      "process.env.NODE_ENV": '"production"',
    },
  });
  server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/checkout.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else if (request.url?.startsWith("/api/trpc/")) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      calls.push({
        url: request.url,
        method: request.method,
        key: request.headers["idempotency-key"],
        body: Buffer.concat(chunks).toString(),
        at: Date.now(),
      });
      response.setHeader("Content-Type", "application/json");
      if (mode === "next-terminal") {
        firstCall();
        await proofGate;
      }
      if (mode === "quota" && calls.length > 1) {
        response.statusCode = 429;
        response.setHeader("Retry-After", "60");
        response.end(
          JSON.stringify({
            error: {
              json: {
                message: "Повторите проверку позже.",
                code: -32029,
                data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
              },
            },
          }),
        );
      } else {
        response.end(
          JSON.stringify({
            result: {
              data: {
                json: {
                  state:
                    mode !== "next-terminal" && calls.length === 1
                      ? "pending"
                      : "canceled",
                },
              },
            },
          }),
        );
      }
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        "<!doctype html><title>Local checkout return acceptance</title>",
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

for (const responseMode of ["canceled", "quota"]) {
  test(
    `real browser polling stops on ${responseMode}, ignoring forged return flags`,
    { timeout: 20_000 },
    async () => {
      mode = responseMode;
      calls = [];
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(`${origin}/club?paid=1&payment=returned&order=forged`);
        const saved = await page.evaluate(async (storageKey) => {
          const api = await import("/checkout.js");
          const intent = await api.getClubCheckoutIntent({
            email: "buyer@example.test",
          });
          window.states = [];
          window.controller = new AbortController();
          window.polling = api
            .pollClubTestCheckout(api.createTRPCClient(), {
              signal: window.controller.signal,
              onResult: (result) => window.states.push(result.state),
            })
            .then(
              (result) => ({ result }),
              (error) => ({ error: String(error) }),
            );
          return {
            key: intent.idempotencyKey,
            record: localStorage.getItem(storageKey),
          };
        }, storageKey);
        const outcome = await page.evaluate(() => window.polling);
        if (mode === "canceled") {
          assert.deepEqual(outcome, {
            result: { idempotencyKey: saved.key, state: "canceled" },
          });
          assert.deepEqual(await page.evaluate(() => window.states), [
            "pending",
            "canceled",
          ]);
        } else {
          assert.ok(outcome.error);
          assert.deepEqual(await page.evaluate(() => window.states), [
            "pending",
          ]);
        }
        // Wait beyond the next real polling interval to prove no implicit retry.
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 5500)),
        );
        assert.equal(calls.length, 2);
        assert.ok(calls[1].at - calls[0].at >= 4800);
        for (const call of calls) {
          assert.equal(call.method, "POST");
          assert.equal(call.url, "/api/trpc/club.reconcileCheckout");
          assert.equal(call.key, saved.key);
          assert.ok(!call.body.includes(saved.key));
          assert.ok(!call.body.includes("buyer"));
        }
        assert.equal(
          await page.evaluate((key) => localStorage.getItem(key), storageKey),
          saved.record,
        );
      } finally {
        await context.close();
      }
    },
  );
}

test(
  "two real tabs reserve at most one next intent after locked terminal proof",
  { timeout: 10_000 },
  async () => {
    mode = "next-terminal";
    calls = [];
    const requestReceived = new Promise((resolve) => {
      firstCall = resolve;
    });
    proofGate = new Promise((resolve) => {
      releaseProof = resolve;
    });
    const context = await browser.newContext();
    try {
      const first = await context.newPage();
      const second = await context.newPage();
      await first.goto(`${origin}/club`);
      await second.goto(`${origin}/club`);
      const previousIdempotencyKey = await first.evaluate(async () => {
        const api = await import("/checkout.js");
        return (
          await api.getClubCheckoutIntent({ email: "prior@example.test" })
        ).idempotencyKey;
      });
      const start = (page) =>
        page.evaluate(async (previousIdempotencyKey) => {
          const api = await import("/checkout.js");
          window.next = api
            .reserveNextClubCheckoutIntent(api.createTRPCClient(), {
              previousIdempotencyKey,
              selection: { email: "next@example.test", plan: "semiannual" },
            })
            .then(
              (result) => ({ result }),
              (error) => ({ reason: error.reason }),
            );
        }, previousIdempotencyKey);
      await start(first);
      await requestReceived;
      await start(second);
      await second.waitForFunction(
        async () => (await navigator.locks.query()).pending.length === 1,
      );
      releaseProof();
      const winner = await first.evaluate(() => window.next);
      assert.ok(winner.result);
      assert.notEqual(winner.result.idempotencyKey, previousIdempotencyKey);
      assert.deepEqual(await second.evaluate(() => window.next), {
        reason: "stale-intent",
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].key, previousIdempotencyKey);
      assert.equal(calls[0].url, "/api/trpc/club.reconcileCheckout");
      assert.equal(calls[0].method, "POST");
      assert.ok(!calls[0].body.includes(previousIdempotencyKey));
      assert.ok(!calls[0].body.includes("example.test"));
      const recovered = await second.evaluate(async () => {
        const api = await import("/checkout.js");
        return api.getClubCheckoutIntent({
          email: "next@example.test",
          plan: "semiannual",
        });
      });
      assert.deepEqual(recovered, winner.result);
    } finally {
      releaseProof();
      await context.close();
    }
  },
);
