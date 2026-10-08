import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
let browser, server, origin, mode, calls;

before(async () => {
  const frontend = new URL("../apps/frontend/", import.meta.url).pathname;
  const bundle = await build({
    stdin: {
      contents: `
        import { createElement, StrictMode } from "react";
        import { createRoot } from "react-dom/client";
        import { ClubTestCheckoutResult } from "./src/features/club/checkout-result";
        import { createTRPCClient } from "./src/shared/api/trpc";
        export { getClubCheckoutIntent } from "./src/features/club/checkout-intent";
        const client = createTRPCClient();
        let root;
        export function mount(active = true, strict = false) {
          root ??= createRoot(document.getElementById("root"));
          const screen = createElement(ClubTestCheckoutResult, {client, active});
          root.render(strict ? createElement(StrictMode, null, screen) : screen);
        }
        export function unmount() { root.unmount(); }
        // Visibility is the sole synthetic platform boundary. React, storage,
        // controller, timers and keyed HTTP transport run unchanged in Chromium.
        export function visibility(hidden) {
          Object.defineProperty(document, "hidden", {configurable:true, value:hidden});
          document.dispatchEvent(new Event("visibilitychange"));
        }
      `,
      resolveDir: frontend,
    },
    tsconfig: `${frontend}tsconfig.json`,
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    loader: { ".scss": "empty" },
    define: {
      "process.env.NEXT_PUBLIC_API_BASE_URL": '""',
      "process.env.NODE_ENV": '"development"',
    },
  });
  server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/screen.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else if (request.url?.startsWith("/api/trpc/")) {
      for await (const _chunk of request) {
        /* drain only synthetic input */
      }
      calls.push({
        url: request.url,
        method: request.method,
        key: request.headers["idempotency-key"],
      });
      response.setHeader("Content-Type", "application/json");
      if (mode === "quota") {
        response.statusCode = 429;
        response.setHeader("Retry-After", "45");
        response.end(
          JSON.stringify({
            error: {
              json: {
                message: "PRIVATE",
                code: -32029,
                data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
              },
            },
          }),
        );
      } else {
        response.end(
          JSON.stringify({ result: { data: { json: { state: mode } } } }),
        );
      }
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><title>Local result screen</title><div id="root"></div>',
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
  await new Promise((resolve) => server.close(resolve));
});

async function screen(
  t,
  state,
  { saved = true, active = true, strict = false } = {},
) {
  mode = state;
  calls = [];
  const context = await browser.newContext();
  context.setDefaultTimeout(5000);
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${origin}/club?paid=1&payment=returned&order=untrusted`);
  await page.evaluate(
    async ({ saved, active, strict }) => {
      window.fixture = await import("/screen.js");
      if (saved)
        await fixture.getClubCheckoutIntent({ email: "buyer@example.test" });
      window.prior = localStorage.getItem(
        "daryadarcy:club-checkout:yookassa-test:v1",
      );
      fixture.mount(active, strict);
    },
    { saved, active, strict },
  );
  return page;
}
async function unchanged(page) {
  const key = await page.evaluate(() =>
    window.prior ? JSON.parse(window.prior).idempotencyKey : null,
  );
  assert.equal(
    await page.evaluate(
      (key) => localStorage.getItem(key) === window.prior,
      storageKey,
    ),
    true,
  );
  assert.equal(
    await page
      .locator("body")
      .innerText()
      .then((text) => /[0-9a-f]{8}-[0-9a-f-]{27}/i.test(text)),
    false,
  );
  assert.ok(
    calls.every(
      (call) =>
        call.method === "POST" &&
        call.key === key &&
        call.url === "/api/trpc/club.reconcileCheckout",
    ),
  );
}

test("only server-checked states render; URL success flags cannot grant access", async (t) => {
  for (const [state, text] of [
    ["unknown", "Результат пока неизвестен"],
    ["canceled", "Тестовая оплата отменена"],
    ["succeeded", "Тестовая оплата подтверждена сервером"],
  ]) {
    const page = await screen(t, state);
    await page.getByRole("status").filter({ hasText: text }).waitFor();
    assert.equal(calls.length, 1);
    assert.equal(
      await page.getByRole("button", { name: /купить|оплатить/i }).count(),
      0,
    );
    await unchanged(page);
  }
});
test("missing evidence performs no HTTP and SSR-like initial inactive screen does not start checks", async (t) => {
  const missing = await screen(t, "succeeded", { saved: false });
  await missing
    .getByRole("status")
    .filter({ hasText: "В этом браузере нет сохранённой заявки" })
    .waitFor();
  assert.equal(calls.length, 0);
  await unchanged(missing);
  const inactive = await screen(t, "canceled", { active: false });
  await inactive.getByRole("button", { name: "Проверить статус" }).waitFor();
  assert.equal(await inactive.getByRole("button").isDisabled(), true);
  assert.equal(calls.length, 0);
  await inactive.evaluate(() => fixture.mount(true));
  await inactive.getByRole("button").waitFor();
  assert.equal(calls.length, 0);
  await inactive.getByRole("button").click();
  await inactive
    .getByRole("status")
    .filter({ hasText: "Тестовая оплата отменена" })
    .waitFor();
  assert.equal(calls.length, 1);
});
test("hidden document or retained inactive tab cancels polling and never automatically resumes", async (t) => {
  for (const kind of ["visibility", "activity"]) {
    const page = await screen(t, "pending");
    await page
      .getByRole("status")
      .filter({ hasText: "Ожидаем результат тестовой оплаты" })
      .waitFor();
    await page.evaluate(
      (kind) =>
        kind === "visibility" ? fixture.visibility(true) : fixture.mount(false),
      kind,
    );
    await page
      .getByRole("status")
      .filter({ hasText: "Проверка приостановлена" })
      .waitFor();
    assert.equal(await page.getByRole("button").isDisabled(), true);
    await page.evaluate(
      (kind) =>
        kind === "visibility" ? fixture.visibility(false) : fixture.mount(true),
      kind,
    );
    await page.waitForTimeout(5200);
    assert.equal(calls.length, 1);
    mode = "canceled";
    await page.getByRole("button").click();
    await page
      .getByRole("status")
      .filter({ hasText: "Тестовая оплата отменена" })
      .waitFor();
    assert.equal(calls.length, 2);
    await unchanged(page);
  }
});
test("unmount and StrictMode cleanup prevent extra polls and late rendering", async (t) => {
  const page = await screen(t, "pending", { strict: true });
  await page
    .getByRole("status")
    .filter({ hasText: "Ожидаем результат тестовой оплаты" })
    .waitFor();
  const count = calls.length;
  await page.evaluate(() => fixture.unmount());
  await page.waitForTimeout(5200);
  assert.equal(calls.length, count);
  assert.equal(await page.getByRole("status").count(), 0);
  await unchanged(page);
});
test("quota cooldown survives retained-tab hide and expiry only enables explicit check", async (t) => {
  const context = await browser.newContext();
  context.setDefaultTimeout(5000);
  t.after(() => context.close());
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-10-08T00:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-08T01:00:00Z"));
  mode = "quota";
  calls = [];
  await page.goto(origin);
  await page.evaluate(async () => {
    window.fixture = await import("/screen.js");
    await fixture.getClubCheckoutIntent({ email: "buyer@example.test" });
    window.prior = localStorage.getItem(
      "daryadarcy:club-checkout:yookassa-test:v1",
    );
    fixture.mount();
  });
  await page
    .getByRole("status")
    .filter({ hasText: "Повторная проверка" })
    .waitFor();
  assert.equal(await page.getByRole("button").isDisabled(), true);
  assert.equal(
    (await page.locator("body").innerText()).includes("PRIVATE"),
    false,
  );
  await page.evaluate(() => fixture.mount(false));
  await page.evaluate(() => fixture.mount(true));
  await page.clock.runFor(44_999);
  assert.equal(await page.getByRole("button").isDisabled(), true);
  await page.clock.runFor(1);
  assert.equal(await page.getByRole("button").isEnabled(), true);
  assert.equal(calls.length, 1);
  mode = "canceled";
  await page.getByRole("button").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Тестовая оплата отменена" })
    .waitFor();
  assert.equal(calls.length, 2);
  await unchanged(page);
});
