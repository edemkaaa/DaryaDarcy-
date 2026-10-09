import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

// Run after an explicit local build; CHECKOUT_UI_EXPECTED_MODE=legacy checks
// an off build. The default expectation is an explicit TEST build.
// CHECKOUT_UI_EXPECTED_MODE=prodamus checks an explicit Prodamus TEST build.
// Only the owned loopback Next process is started, never an API/DB/provider.
const expectedMode = process.env.CHECKOUT_UI_EXPECTED_MODE ?? "test";
assert.ok(["test", "legacy", "prodamus"].includes(expectedMode));
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
        NEXT_PUBLIC_PRODAMUS_TEST_ENABLED:
          expectedMode === "prodamus" ? "false" : "true",
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
    ({ storageKey, record, origin, expectedMode }) => {
      if (
        location.origin === origin &&
        localStorage.getItem(storageKey) === null
      )
        localStorage.setItem(storageKey, record);
      if (location.origin === origin && expectedMode === "prodamus")
        localStorage.setItem(
          "darcy:user:101:@darcy_club_profile_completed",
          "true",
        );
    },
    { storageKey, record, origin, expectedMode },
  );
  let result = "unknown";
  let user = null;
  let subscribed = false;
  const demoUrl =
    "https://testpage1.payform.ru/?demo_mode=1&payments_limit=1&sum=790.00&currency=rub&order_id=club-test-101-00000000-0000-4000-8000-000000000001";
  let checkoutUrl = "https://yoomoney.ru/checkout/payments/fixture";
  const calls = [],
    errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.href === "https://yoomoney.ru/checkout/payments/fixture" ||
      url.href === demoUrl
    )
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
        return route.fulfill({ json: { user } });
      if (expectedMode === "prodamus" && url.pathname === "/api/capabilities")
        return route.fulfill({
          json: {
            smsLogin: false,
            penPals: false,
            shopOnlinePayment: false,
            webPush: false,
          },
        });
      if (
        expectedMode === "prodamus" &&
        url.pathname.startsWith("/api/trpc/") &&
        !url.pathname.includes("club.createCheckout")
      ) {
        const names = url.pathname.split("/api/trpc/")[1].split(",");
        const results = names.map((name) => ({
          result: {
            data: {
              json:
                name === "club.subscription"
                  ? {
                      subscribed,
                      expiresAt: subscribed ? "2040-11-01T10:00:00Z" : null,
                      cancelAtPeriodEnd: false,
                      isOwner: false,
                      monthlyPrice: "990",
                    }
                  : name === "club.claimPending"
                    ? {
                        granted: subscribed,
                        orderId: subscribed ? "club-test-fixture" : null,
                      }
                    : name === "club.list" || name === "feed.listPaginated"
                      ? { posts: [], nextCursor: null }
                      : name === "feed.userInteractions"
                        ? { likedIds: [], savedIds: [] }
                        : name === "clubProfile.get" || name === "quiz.myResult"
                          ? null
                          : [],
            },
          },
        }));
        return route.fulfill({
          json: url.searchParams.get("batch") === "1" ? results : results[0],
        });
      }
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
                  url: checkoutUrl,
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
  if (expectedMode === "prodamus") {
    const purchase = page.getByRole("button", {
      name: "Открыть тестовую оплату",
      exact: true,
    });
    await purchase.first().waitFor();
    const installGuide = page.getByRole("dialog", {
      name: "Установка приложения",
    });
    await installGuide.waitFor();
    await page.keyboard.press("Escape");
    await installGuide.waitFor({ state: "hidden" });
    assert.equal(await purchase.count(), 2);
    assert.equal(
      await page
        .getByText("в письме будет инструкция", { exact: false })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByText("Автосписание каждый месяц.", { exact: false })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Войти для проверки доступа",
          exact: true,
        })
        .count(),
      1,
    );
    assert.equal(calls.filter((call) => call.path.includes("club.")).length, 0);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page
        .getByRole("region", { name: "Тестовая оплата Prodamus" })
        .waitFor();
      const notice = await page
        .getByRole("region", { name: "Тестовая оплата Prodamus" })
        .boundingBox();
      const header = await page
        .locator('header[aria-label="Навигация профиля"]:visible')
        .boundingBox();
      assert.ok(notice.y >= header.y + header.height);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `prodamus-test-${width}.png`,
        fullPage: true,
      });
      const card = page
        .getByText("Тестовый доступ", { exact: true })
        .locator("..");
      await card.scrollIntoViewIfNeeded();
      assert.equal(await card.getByText("790 ₽", { exact: true }).count(), 1);
      assert.equal(
        await card.getByText("/ 30 дней", { exact: true }).count(),
        1,
      );
      await card.screenshot({ path: `prodamus-test-card-${width}.png` });
      await page
        .locator("main .ui-scroll:not(.ui-scroll-horizontal):visible")
        .first()
        .evaluate((node) => {
          node.scrollTop = 0;
        });
    }
    await page
      .getByLabel("Почта для чека и входа")
      .first()
      .fill("buyer@example.test");
    await purchase.first().click();
    // Next's route announcer is also an alert; wait for the payment refusal,
    // not that unrelated live region, before changing the synthetic response.
    await page
      .getByRole("alert")
      .filter({
        hasText: "Не удалось открыть оплату: получен некорректный адрес.",
      })
      .first()
      .waitFor();
    assert.ok(page.url().startsWith(origin)); // TEST refuses a live/provider mismatch.
    checkoutUrl = demoUrl;
    page.on("dialog", (dialog) => dialog.accept());
    await purchase.first().click();
    await page.waitForURL(demoUrl);
    const creates = calls.filter((call) =>
      call.path.includes("club.createCheckout"),
    );
    assert.equal(creates.length, 2);
    assert.ok(creates.every((call) => call.key === undefined));
    const input = JSON.parse(creates[1].body);
    assert.deepEqual(input["0"] ?? input, {
      json: { email: "buyer@example.test" },
    });
    await page.goto(`${origin}/club`);
    await page
      .getByRole("button", { name: "Войти для проверки доступа", exact: true })
      .click();
    await page.waitForURL(
      (url) => url.pathname === "/login" && url.search === "",
    );
    user = {
      id: 101,
      openId: "prodamus-test-member",
      name: "Участница",
      email: "buyer@example.test",
      role: "user",
      lastSignedIn: "2026-10-01T10:00:00Z",
    };
    await page.goto(`${origin}/club`); // The new backend returns here without paid=1.
    const check = page.getByRole("button", {
      name: "Проверить доступ",
      exact: true,
    });
    await check.waitFor();
    await check.click();
    await page
      .getByRole("status")
      .filter({ hasText: "Тестовая оплата пока не подтверждена" })
      .waitFor();
    assert.equal(
      calls.filter((call) => call.path.includes("club.createCheckout")).length,
      2,
    );
    subscribed = true;
    await check.click();
    await page
      .getByRole("button", { name: "Комьюнити", exact: true })
      .waitFor();
    await page.goto(`${origin}/profile`);
    await page.getByText("Тестовый доступ до", { exact: false }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Отменить подписку", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByText("Следующее списание:", { exact: false }).count(),
      0,
    );
    assert.equal(errors.length, 0);
    return;
  }
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
