import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
let browser, server, origin, mode, calls, releaseCreate, paymentUrl;

before(async () => {
  const frontend = new URL("../apps/frontend/", import.meta.url).pathname;
  const bundle = await build({
    stdin: {
      contents: `
        import { createElement, StrictMode } from "react";
        import { createRoot } from "react-dom/client";
        import { ClubTestCheckoutResult } from "./src/features/club/checkout-result";
        import { ClubCheckoutMode } from "./src/features/club/checkout-mode";
        import { createTRPCClient, trpc } from "./src/shared/api/trpc";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import { ScreenActivity } from "./src/shared/navigation/screen-activity";
        import { AuthProvider } from "./src/domain/session/session-context";
        export { getClubCheckoutIntent } from "./src/features/club/checkout-intent";
        export { cancelSessionRequests } from "./src/shared/api/request-lifecycle";
        const client = createTRPCClient();
        const queryClient = new QueryClient();
        let root;
        export function mount(active = true, strict = false) {
          root ??= createRoot(document.getElementById("root"));
          const screen = createElement(ClubTestCheckoutResult, {client, active});
          root.render(strict ? createElement(StrictMode, null, screen) : screen);
        }
        export function mountPurchase(active = true, sessionReady = true, accountEmail = null) {
          root ??= createRoot(document.getElementById("root"));
          root.render(createElement(ClubTestCheckoutResult, {
            client, active, purchase: {sessionReady, accountEmail},
          }));
        }
        export function mountMode(active = true) {
          root ??= createRoot(document.getElementById("root"));
          root.render(createElement(QueryClientProvider, {client:queryClient},
            createElement(trpc.Provider, {client,queryClient},
              createElement(ScreenActivity.Provider, {value:active},
                createElement(AuthProvider, null,
                  createElement(ClubCheckoutMode, null, createElement("button",null,"Legacy purchase")),
                ),
              ),
            ),
          ));
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
    // Decoration assets use a fixed local fixture; no image bytes are bundled
    // and the actual checkout/mode/provider code remains unchanged.
    plugins: [
      {
        name: "local-decoration-assets",
        setup(build) {
          // Подменяет только декоративческие картинки локальной заглушкой, оставляя React и платёжный контроллер настоящими.

          build.onLoad({ filter: /\.(png|jpe?g|webp)$/ }, () => ({
            contents: 'export default {src:"/fixture-image"};',
            loader: "js",
          }));
        },
      },
    ],
    define: {
      "process.env": "{}",
      "process.env.NEXT_PUBLIC_API_BASE_URL": '""',
      "process.env.NEXT_PUBLIC_CLUB_TEST_CHECKOUT": '"true"',
      "process.env.NODE_ENV": '"development"',
    },
  });
  // HTTP-подмена управляет create/status, квотами и потерянными ответами; реальные React, Web Locks и localStorage работают внутри Chromium.
  server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/screen.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else if (request.url === "/api/auth/me") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ user: null }));
    } else if (request.url?.startsWith("/api/trpc/")) {
      let body = "";
      for await (const chunk of request) body += chunk;
      calls.push({
        url: request.url,
        method: request.method,
        key: request.headers["idempotency-key"],
        body,
      });
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/api/trpc/club.createCheckout") {
        if (mode === "create-held") {
          releaseCreate = () =>
            response.end(
              JSON.stringify({
                result: {
                  data: {
                    json: {
                      url: paymentUrl,
                      user: null,
                    },
                  },
                },
              }),
            );
        } else if (mode === "create-failure") {
          response.statusCode = 500;
          response.end(
            JSON.stringify({
              error: {
                json: {
                  message: "PRIVATE payment URL",
                  code: -32603,
                  data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
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
                    url: paymentUrl,
                    user: null,
                  },
                },
              },
            }),
          );
        }
      } else if (mode === "quota") {
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
          JSON.stringify({
            result: {
              data: {
                json: { state: mode.startsWith("create-") ? "unknown" : mode },
              },
            },
          }),
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

test("a real held writer lock is canceled before reservation when the purchase screen hides", async (t) => {
  // Сценарий: Скрытие экрана покупки отменяет ожидание настоящего Web Lock до резервирования намерения.

  const page = await purchaseScreen(t);
  await page.evaluate((key) => {
    window.held = navigator.locks.request(
      key,
      () =>
        new Promise((resolve) => {
          window.releaseLock = resolve;
        }),
    );
  }, storageKey);
  await page.waitForFunction(() => typeof window.releaseLock === "function");
  await page.getByLabel("Почта получателя доступа").fill("buyer@example.test");
  await page
    .getByRole("button", { name: "Создать тестовую заявку", exact: true })
    .click();
  await page.waitForFunction(
    async () => (await navigator.locks.query()).pending.length === 1,
  );
  await page.evaluate(() => {
    fixture.visibility(true);
    window.releaseLock();
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Покупка приостановлена" })
    .waitFor();
  assert.equal(calls.length, 0);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    null,
  );
  await page.evaluate(() => fixture.visibility(false));
  assert.equal(
    await page
      .getByRole("button", { name: "Создать тестовую заявку", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(calls.length, 0);
});

test("hidden/inactive/session/unmount cancellation fences late creation navigation and never retries", async (t) => {
  // Сценарий: Скрытие, неактивность, смена сессии/почты и unmount блокируют позднюю навигацию без автоматических повторов.

  for (const kind of [
    "visibility",
    "activity",
    "session",
    "session-not-ready",
    "unmount",
    "account-email",
  ]) {
    releaseCreate = null;
    const page = await purchaseScreen(t, { state: "create-held" });
    await page
      .getByLabel("Почта получателя доступа")
      .fill("buyer@example.test");
    await page
      .getByRole("button", { name: "Создать тестовую заявку", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('button[type="submit"]')
        ?.textContent.includes("Готовим"),
    );
    // Wait for the local HTTP boundary, not an arbitrary delay.
    const deadline = Date.now() + 5000;
    while (!releaseCreate) {
      assert.ok(Date.now() < deadline);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const raw = await page.evaluate(
      (key) => localStorage.getItem(key),
      storageKey,
    );
    await page.evaluate((kind) => {
      if (kind === "visibility") fixture.visibility(true);
      else if (kind === "activity") fixture.mountPurchase(false);
      else if (kind === "session") fixture.cancelSessionRequests();
      else if (kind === "session-not-ready") fixture.mountPurchase(true, false);
      else if (kind === "account-email")
        fixture.mountPurchase(true, true, "other@example.test");
      else fixture.unmount();
    }, kind);
    if (kind !== "unmount")
      await page
        .getByRole("alert")
        .filter({ hasText: "Покупка приостановлена" })
        .waitFor();
    releaseCreate();
    if (kind === "visibility")
      await page.evaluate(() => fixture.visibility(false));
    if (kind === "activity" || kind === "session-not-ready")
      await page.evaluate(() => fixture.mountPurchase());
    assert.equal(calls.length, 1);
    assert.equal(new URL(page.url()).origin, origin);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      raw,
    );
    if (kind !== "unmount")
      assert.equal(
        await page
          .getByRole("button", { name: "Создать тестовую заявку", exact: true })
          .isDisabled(),
        true,
      );
  }
});

test("purchase cannot start while session is unresolved; an account email remains read-only", async (t) => {
  // Сценарий: Неразрешённая сессия запрещает покупку, email вошедшего аккаунта доступен только для чтения.

  const page = await purchaseScreen(t);
  await page.evaluate(() => fixture.mountPurchase(true, false));
  const form = page.getByRole("form", { name: "Тестовая покупка клуба" });
  await form.evaluate((form) =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  assert.equal(calls.length, 0);
  await page.evaluate(() =>
    fixture.mountPurchase(true, true, "account@example.test"),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('input[type="email"]')?.value ===
      "account@example.test",
  );
  assert.equal(
    await page.getByLabel("Почта получателя доступа").getAttribute("readonly"),
    "",
  );
});

test("fresh next-purchase proof honors quota across hiding; expiry alone cannot create or retry", async (t) => {
  // Сценарий: Cooldown свежей проверки следующей покупки переживает скрытие; истечение срока не создаёт запрос автоматически.

  const page = await purchaseScreen(t, { saved: true });
  mode = "canceled";
  await page.getByRole("button", { name: "Проверить статус" }).click();
  const next = page.getByRole("button", {
    name: "Новая тестовая покупка",
    exact: true,
  });
  await next.waitFor();
  await page.getByLabel("Почта получателя доступа").fill("next@example.test");
  await page.clock.install({ time: new Date("2026-10-08T00:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-08T01:00:00Z"));
  mode = "quota";
  await next.click();
  await page
    .getByRole("status")
    .filter({ hasText: "Повторная проверка" })
    .waitFor();
  const check = page.getByRole("button", { name: "Проверить статус" });
  assert.equal(await check.isDisabled(), true);
  await page.evaluate(() => fixture.mountPurchase(false));
  await page.evaluate(() => fixture.mountPurchase());
  await page.clock.runFor(44_999);
  assert.equal(await check.isDisabled(), true);
  await page.clock.runFor(1);
  assert.equal(await check.isEnabled(), true);
  assert.equal(calls.length, 3);
  await unchanged(page);
  assert.equal(
    (await page.locator("body").innerText()).includes("PRIVATE"),
    false,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Создать тестовую заявку", exact: true })
      .isDisabled(),
    true,
  );
});

test("a real create timeout leaves one durable key and blocks purchase until an explicit check", async (t) => {
  // Сценарий: Таймаут create сохраняет один durable-ключ и разрешает восстановление только после явной проверки.

  releaseCreate = null;
  const page = await purchaseScreen(t, { state: "create-held" });
  await page.clock.install({ time: new Date("2026-10-08T00:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-08T01:00:00Z"));
  await page.getByLabel("Почта получателя доступа").fill("buyer@example.test");
  await page
    .getByRole("button", { name: "Создать тестовую заявку", exact: true })
    .click();
  const deadline = Date.now() + 5000;
  while (!releaseCreate) {
    assert.ok(Date.now() < deadline);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  await page.clock.runFor(15_000);
  await page.getByRole("alert").waitFor();
  assert.equal(calls.length, 1);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    raw,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Создать тестовую заявку", exact: true })
      .isDisabled(),
    true,
  );
  releaseCreate();
  mode = "create-success";
  await page.getByRole("button", { name: "Проверить статус" }).click();
  const restore = page.getByRole("button", {
    name: "Восстановить прежнюю заявку",
    exact: true,
  });
  await restore.waitFor();
  await restore.click();
  await page.waitForURL("https://yoomoney.ru/checkout/payments/fixture");
  assert.equal(calls.length, 3);
  assert.equal(calls[2].key, calls[0].key);
});

async function purchaseScreen(
  t,
  {
    saved = false,
    state = "create-success",
    destination = "https://yoomoney.ru/checkout/payments/fixture",
  } = {},
) {
  // Подготавливает экран покупки с локальным назначением провайдера и ожидаемым состоянием сохранённого намерения.

  paymentUrl = destination;
  const page = await screen(t, state, { saved });
  await page.context().route("https://yoomoney.ru/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Synthetic provider destination</title>",
    }),
  );
  await page.evaluate(() => fixture.mountPurchase());
  await page
    .getByRole("status")
    .filter({
      hasText: saved ? "Результат пока неизвестен" : "нет сохранённой заявки",
    })
    .waitFor();
  return page;
}

test("TEST form creates only on explicit valid submit, persists before HTTP, and opens a synthetic destination", async (t) => {
  // Сценарий: Форма создаёт заявку лишь по корректному явному submit, сохраняет ключ до HTTP и блокирует двойной клик.

  const page = await purchaseScreen(t);
  const submit = page.getByRole("button", {
    name: "Создать тестовую заявку",
    exact: true,
  });
  await submit.waitFor();
  assert.equal(calls.length, 0);
  await submit.click(); // Native validation rejects the blank email.
  assert.equal(calls.length, 0);
  await page
    .getByLabel("Почта получателя доступа")
    .fill(" BUYER@EXAMPLE.TEST ");
  // HTML email input trims surrounding spaces; the intent also canonicalizes.
  await submit.evaluate((button) => {
    button.click();
    button.click();
  });
  await page.waitForURL("https://yoomoney.ru/checkout/payments/fixture");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/trpc/club.createCheckout");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), {
    json: { email: "buyer@example.test", plan: "monthly" },
  });
  await page.goto(origin);
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  assert.equal(JSON.parse(raw).idempotencyKey, calls[0].key);
  assert.equal(raw.includes("buyer@"), false);
});

test("TEST form refuses unexpected provider URLs without navigation, retry or erasing evidence", async (t) => {
  // Сценарий: Неожиданный платёжный URL не вызывает навигацию, повтор или удаление доказательства.

  for (const destination of [
    "https://elsewhere.example.test/checkout/private",
    "https://yoomoney.ru.evil.example.test/checkout/private",
    "https://yoomoney.ru:444/checkout/private",
    "https://yoomoney.ru/checkout/private#private",
    "https://yoomoney.ru/unexpected/private",
    "javascript:alert('private')",
  ]) {
    const page = await purchaseScreen(t, { destination });
    await page
      .getByLabel("Почта получателя доступа")
      .fill("buyer@example.test");
    await page
      .getByRole("button", { name: "Создать тестовую заявку", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    assert.equal(calls.length, 1);
    assert.equal(new URL(page.url()).origin, origin);
    assert.equal(
      (await page.locator("body").innerText()).includes("private"),
      false,
    );
    assert.equal(
      JSON.parse(
        await page.evaluate((key) => localStorage.getItem(key), storageKey),
      ).idempotencyKey,
      calls[0].key,
    );
  }
});

test("failed creation preserves its key, requires a status check, and restores only the same selection explicitly", async (t) => {
  // Сценарий: Неудачный create требует сверки статуса и восстанавливает только тот же выбор с прежним ключом.

  const page = await purchaseScreen(t, { state: "create-failure" });
  await page.getByLabel("Почта получателя доступа").fill("buyer@example.test");
  await page
    .getByRole("button", { name: "Создать тестовую заявку", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  const key = calls[0].key;
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  assert.equal(JSON.parse(raw).idempotencyKey, key);
  assert.equal(
    (await page.locator("body").innerText()).includes("PRIVATE"),
    false,
  );
  assert.equal(
    await page
      .getByRole("button", {
        name: /Создать тестовую заявку|Восстановить прежнюю заявку|Новая тестовая покупка/,
      })
      .isDisabled(),
    true,
  );
  assert.equal(calls.length, 1);
  mode = "create-success";
  await page.getByRole("button", { name: "Проверить статус" }).click();
  const restore = page.getByRole("button", {
    name: "Восстановить прежнюю заявку",
    exact: true,
  });
  await restore.waitFor();
  await page.getByLabel("Почта получателя доступа").fill("other@example.test");
  await restore.click();
  await page.getByRole("alert").waitFor();
  assert.equal(calls.length, 2); // Only the manual status check, no new create.
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    raw,
  );
  await page.getByRole("button", { name: "Проверить статус" }).click();
  await restore.waitFor();
  await page.getByLabel("Почта получателя доступа").fill("buyer@example.test");
  await restore.click();
  await page.waitForURL("https://yoomoney.ru/checkout/payments/fixture");
  const creates = calls.filter((call) =>
    call.url.endsWith("club.createCheckout"),
  );
  assert.equal(creates.length, 2);
  assert.equal(creates[1].key, key);
  assert.equal(creates[1].body, creates[0].body);
});

test("new purchase rechecks terminal proof under the old key; pending cannot rotate or create", async (t) => {
  // Сценарий: Следующая покупка заново проверяет терминальность под старым ключом; pending не создаёт новый платёж.

  const page = await purchaseScreen(t, { saved: true });
  mode = "canceled";
  await page.getByRole("button", { name: "Проверить статус" }).click();
  const next = page.getByRole("button", {
    name: "Новая тестовая покупка",
    exact: true,
  });
  await next.waitFor();
  await page.getByLabel("Почта получателя доступа").fill("next@example.test");
  mode = "pending";
  await next.click();
  await page.getByRole("alert").waitFor();
  assert.equal(calls.length, 3); // initial, manual and fresh locked checks
  await unchanged(page);
  mode = "canceled";
  await page.getByRole("button", { name: "Проверить статус" }).click();
  await next.waitFor();
  await next.click();
  await page.waitForURL("https://yoomoney.ru/checkout/payments/fixture");
  assert.equal(calls.length, 6);
  assert.equal(calls[4].key, calls[0].key);
  assert.equal(calls[4].url, "/api/trpc/club.reconcileCheckout");
  assert.equal(calls[5].url, "/api/trpc/club.createCheckout");
  assert.notEqual(calls[5].key, calls[0].key);
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function screen(
  t,
  state,
  { saved = true, active = true, strict = false } = {},
) {
  // Создаёт отдельную страницу с запретом внешней сети и монтирует реальный экран результата.

  mode = state;
  calls = [];
  const context = await browser.newContext();
  context.setDefaultTimeout(5000);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
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
  // Проверяет неизменность сохранённого намерения, отсутствие UUID в интерфейсе и только разрешённые POST-проверки.

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
  // Сценарий: Интерфейс показывает только подтверждённые сервером состояния, не доверяя URL-флагам успеха.

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
  // Сценарий: Нет сохранённого намерения или экран изначально неактивен: HTTP не начинается до явного действия.

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
  // Сценарий: Скрытие документа либо удержанная неактивная вкладка останавливает polling без автоматического возобновления.

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
  // Сценарий: Unmount и StrictMode cleanup прекращают дополнительные проверки и поздний рендер.

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
test("real mode/provider retains quota cooldown across tab hides; expiry only enables explicit check", async (t) => {
  // Сценарий: Настоящие mode/provider сохраняют quota cooldown при скрытии; срок лишь включает ручную кнопку проверки.

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
    fixture.mountMode();
  });
  await page
    .getByRole("status")
    .filter({ hasText: "Повторная проверка" })
    .waitFor();
  const check = page.getByRole("button", { name: "Проверить статус" });
  assert.equal(await check.isDisabled(), true);
  assert.equal(
    (await page.locator("body").innerText()).includes("PRIVATE"),
    false,
  );
  await page.evaluate(() => fixture.mountMode(false));
  await page.evaluate(() => fixture.mountMode(true));
  await page.clock.runFor(44_999);
  assert.equal(await check.isDisabled(), true);
  await page.clock.runFor(1);
  assert.equal(await check.isEnabled(), true);
  assert.equal(calls.length, 1);
  mode = "canceled";
  // This lifecycle bundle omits CSS; use the actual accessible keyboard action.
  // Pointer/layout acceptance is covered by the built Next route fixture.
  await check.focus();
  await check.press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "Тестовая оплата отменена" })
    .waitFor();
  assert.equal(calls.length, 2);
  await unchanged(page);
});
