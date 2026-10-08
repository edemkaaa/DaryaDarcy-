import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

// Run after an explicit local build; CHECKOUT_UI_EXPECTED_MODE=legacy checks
// an off build. The default expectation is an explicit TEST build.
// Only the owned loopback Next process is started, never an API/DB/provider.
const expectedMode = process.env.CHECKOUT_UI_EXPECTED_MODE ?? "test";
assert.ok(["test", "legacy"].includes(expectedMode));
let child,
  browser,
  origin,
  output = "";
before(async () => {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(
    process.execPath,
    [
      "../../node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    {
      cwd: new URL("../apps/frontend/", import.meta.url),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        // Runtime changes cannot switch the build's mode in either direction.
        NEXT_PUBLIC_CLUB_TEST_CHECKOUT:
          expectedMode === "test" ? "false" : "true",
        API_PROXY_TARGET: "http://127.0.0.1:1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const capture = (chunk) => {
    output = (output + chunk).slice(-6000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  const deadline = Date.now() + 15000;
  while (!output.includes("Ready in")) {
    if (exited || Date.now() > deadline)
      throw new Error("Owned local frontend did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
});
after(async () => {
  await browser?.close();
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timer);
  }
});

test("real /club build respects its explicit mode and never trusts return flags", async (t) => {
  const context = await browser.newContext();
  context.setDefaultTimeout(5000);
  t.after(() => context.close());
  const key = "00000000-0000-4000-8000-000000000001";
  const record = JSON.stringify({
    version: 1,
    idempotencyKey: key,
    selectionHash: "a".repeat(64),
  });
  const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
  await context.addInitScript(
    ({ storageKey, record, origin }) => {
      if (
        location.origin === origin &&
        localStorage.getItem(storageKey) === null
      )
        localStorage.setItem(storageKey, record);
    },
    { storageKey, record, origin },
  );
  let result = "unknown";
  const calls = [],
    errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.href === "https://yoomoney.ru/checkout/payments/fixture")
      return route.fulfill({
        contentType: "text/html",
        body: "<title>Synthetic checkout destination</title>",
      });
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/api/")) {
      calls.push({
        path: url.pathname,
        method: request.method(),
        key: request.headers()["idempotency-key"],
        body: request.postData(),
      });
      if (url.pathname === "/api/auth/me")
        return route.fulfill({ json: { user: null } });
      if (url.pathname === "/api/trpc/club.reconcileCheckout")
        return route.fulfill({
          json: { result: { data: { json: { state: result } } } },
        });
      if (url.pathname === "/api/trpc/club.createCheckout")
        return route.fulfill({
          json: {
            result: {
              data: {
                json: {
                  url: "https://yoomoney.ru/checkout/payments/fixture",
                  user: null,
                },
              },
            },
          },
        });
      return route.fulfill({
        status: 401,
        json: { error: "Unauthenticated synthetic guest" },
      });
    }
    return route.continue();
  });
  await page.goto(
    `${origin}/club?paid=1&payment=returned&checkout=1&order=forged`,
  );
  if (expectedMode === "legacy") {
    const purchaseButtons = page.getByRole("button", { name: /^Оплатить/ });
    await purchaseButtons.first().waitFor();
    assert.equal(await purchaseButtons.count(), 2);
    assert.equal(
      await page.getByText("Тестовая оплата", { exact: true }).count(),
      0,
    );
    assert.equal(calls.filter((call) => call.path.includes("club.")).length, 0);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      record,
    );
    assert.equal(errors.length, 0);
    return;
  }
  await page
    .getByRole("status")
    .filter({ hasText: "Результат пока неизвестен" })
    .waitFor();
  const installGuide = page.getByRole("dialog", {
    name: "Установка приложения",
  });
  await installGuide.waitFor();
  await page.keyboard.press("Escape");
  await installGuide.waitFor({ state: "hidden" });
  assert.equal(
    await page.getByRole("button", { name: /^Оплатить|купить/i }).count(),
    0,
  );
  assert.equal(
    await page.getByText("Что входит в подписку:", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    record,
  );
  assert.equal(
    calls.filter((call) => call.path.includes("club.reconcileCheckout")).length,
    1,
  );
  result = "canceled";
  await page.getByRole("button", { name: "Проверить статус" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Тестовая оплата отменена" })
    .waitFor();
  assert.equal(
    calls.filter((call) => call.path.includes("club.reconcileCheckout")).length,
    2,
  );
  assert.ok(
    calls
      .filter((call) => call.path.includes("club."))
      .every(
        (call) =>
          call.path === "/api/trpc/club.reconcileCheckout" &&
          call.method === "POST" &&
          call.key === key,
      ),
  );
  assert.equal(errors.length, 0);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    record,
  );
  const next = page.getByRole("button", {
    name: "Новая тестовая покупка",
    exact: true,
  });
  await next.waitFor();
  await page.getByLabel("Почта получателя доступа").fill("buyer@example.test");
  await next.click(); // Actual built route/CSS and provider session, no force click.
  await page.waitForURL("https://yoomoney.ru/checkout/payments/fixture");
  const purchases = calls.filter((call) => call.path.includes("club."));
  assert.equal(purchases.length, 4);
  assert.equal(purchases[2].path, "/api/trpc/club.reconcileCheckout");
  assert.equal(purchases[2].key, key);
  assert.equal(purchases[3].path, "/api/trpc/club.createCheckout");
  assert.equal(purchases[3].method, "POST");
  assert.notEqual(purchases[3].key, key);
  assert.deepEqual(JSON.parse(purchases[3].body), {
    json: { email: "buyer@example.test", plan: "monthly" },
  });
  await page.goto(origin);
  const nextRecord = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  assert.equal(JSON.parse(nextRecord).idempotencyKey, purchases[3].key);
  assert.equal(nextRecord.includes("buyer@"), false);
  assert.equal(errors.length, 0);
});
