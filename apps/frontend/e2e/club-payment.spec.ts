import { expect, test, type Page } from "@playwright/test";
import { ok, failure } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.use({ hasTouch: true });
const destination = "https://payments.example.test/checkout/legacy-one";
const expiration = "2040-11-01T10:00:00Z";
const pay = (page: Page) =>
  page.getByRole("button", { name: /Оплатить 790 ₽$/ });
const check = (page: Page) =>
  page.getByRole("button", { name: "Я уже оплатила", exact: true });
const member = (id = 101) => ({
  id,
  openId: `pay-member-${id}`,
  name: "Участница",
  email: `member-${id}@example.test`,
  role: "user",
  lastSignedIn: "2026-10-01T10:00:00Z",
});
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function fixture(page: Page, authenticated = false, subscribed = false) {
  await layoutApi(page, authenticated);
  const state = {
    user: authenticated ? (member() as ReturnType<typeof member> | null) : null,
    subscription: {
      subscribed,
      expiresAt: subscribed ? expiration : null,
      cancelAtPeriodEnd: false,
      isOwner: false,
      monthlyPrice: "790",
    },
    creates: [] as { email: string }[],
    reads: 0,
    claims: 0,
    create: undefined as (() => unknown | Promise<unknown>) | undefined,
    read: undefined as (() => unknown | Promise<unknown>) | undefined,
    claim: undefined as (() => unknown | Promise<unknown>) | undefined,
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: state.user } }),
  );
  await page.route(destination, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<html lang='ru'><body>Тестовая форма провайдера</body></html>",
    }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    const inputs = JSON.parse(
      route.request().postData() ?? url.searchParams.get("input") ?? "{}",
    );
    const results = await Promise.all(
      names.map(async (name, index) => {
        if (name === "club.createCheckout") {
          expect(route.request().method()).toBe("POST");
          state.creates.push(inputs[index].json);
          return state.create
            ? state.create()
            : ok({ url: destination, user: null });
        }
        if (name === "club.subscription") {
          state.reads++;
          return state.read ? state.read() : ok({ ...state.subscription });
        }
        if (name === "club.claimPending") {
          state.claims++;
          return state.claim
            ? state.claim()
            : ok(
                state.subscription.subscribed
                  ? { granted: true, orderId: "club-existing" }
                  : { granted: false, orderId: null },
              );
        }
        if (name === "feed.userInteractions")
          return ok({ likedIds: [], savedIds: [] });
        if (name === "feed.listPaginated" || name === "club.list")
          return ok({ posts: [], nextCursor: null });
        return ok([]);
      }),
    );
    await route
      .fulfill({
        json: url.searchParams.get("batch") === "1" ? results : results[0],
      })
      .catch(() => {});
  });
  return state;
}
async function open(page: Page, path = "/club?checkout=1") {
  await gotoWithSession(page, path);
  await expect(pay(page).first()).toBeEnabled();
}

for (const width of [320, 390, 1440]) {
  test(`guest validates email and sends one checkout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = await fixture(page);
    const held = deferred();
    state.create = async () => {
      await held.promise;
      return ok({ url: destination, user: null });
    };
    await open(page);
    const email = page.getByLabel("Почта для чека и входа").first();
    await pay(page).first().tap();
    await expect(page.getByRole("alert").first()).toContainText(
      "корректную почту",
    );
    await email.fill("incorrect-email");
    await pay(page).first().click();
    expect(state.creates).toEqual([]);
    await email.fill("  Guest@Example.Test  ");
    await pay(page).first().focus();
    await expect(pay(page).first()).toBeFocused();
    await pay(page).first().press("Enter");
    await expect(pay(page).first()).toBeDisabled();
    await expect(pay(page).last()).toBeDisabled();
    await expect(email).toBeDisabled();
    await pay(page).last().dispatchEvent("click");
    await expect.poll(() => state.creates.length).toBe(1);
    expect(state.creates).toEqual([{ email: "guest@example.test" }]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`checkout-${width}.png`),
    });
    held.resolve();
    await expect(page).toHaveURL(destination);
    await expect(page.getByText("Тестовая форма провайдера")).toBeVisible();
    expect(state.claims).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("profile renewal uses the existing email and never submits a password", async ({
  page,
}) => {
  const state = await fixture(page, true, true);
  state.subscription.cancelAtPeriodEnd = true;
  await gotoWithSession(page, "/profile");
  await page
    .getByRole("button", { name: "Продлить клуб →", exact: true })
    .click();
  await expect(pay(page).first()).toBeEnabled();
  await expect(page.getByLabel("Почта для чека и входа")).toHaveCount(0);
  await pay(page).first().click();
  await expect(page).toHaveURL(destination);
  expect(state.creates).toEqual([{ email: "member-101@example.test" }]);
});

for (const result of [
  { url: "javascript:window.__unsafePayment=1", user: null },
  { url: "http://payments.example.test", user: null },
  { url: destination, user: { id: 101 } },
  { url: destination },
  null,
]) {
  test(`malformed checkout ${JSON.stringify(result)} never redirects or signs in`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.create = () => ok(result);
    await open(page);
    await page
      .getByLabel("Почта для чека и входа")
      .first()
      .fill("guest@example.test");
    await pay(page).first().click();
    await expect(page.getByRole("alert").first()).toContainText(
      "Создание ссылки не подтверждено",
    );
    await expect(page).toHaveURL(/\/club$/);
    expect(state.creates).toHaveLength(1);
    expect(
      await page.evaluate(() => Reflect.get(window, "__unsafePayment")),
    ).toBeUndefined();
  });
}

test("a known checkout refusal permits an explicit retry", async ({ page }) => {
  const state = await fixture(page);
  state.create = () => failure(400);
  await open(page);
  await page
    .getByLabel("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await pay(page).first().click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Тестовая ошибка сохранения",
  );
  state.create = undefined;
  await pay(page).first().click();
  await expect(page).toHaveURL(destination);
  expect(state.creates).toHaveLength(2);
});

test("unknown checkout asks before preparing another order and never retries automatically", async ({
  page,
}) => {
  const state = await fixture(page);
  state.create = () => failure(500);
  await open(page);
  await page
    .getByLabel("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await pay(page).first().click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Создание ссылки не подтверждено",
  );
  await expect(page.getByText("PRIVATE_INTERNAL_DETAILS")).toHaveCount(0);
  await pay(page).first().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("checkout-error-390.png"),
  });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("другую заявку");
    await dialog.dismiss();
  });
  await pay(page).first().click();
  expect(state.creates).toHaveLength(1);
  state.create = undefined;
  page.once("dialog", (dialog) => dialog.accept());
  await pay(page).first().click();
  await expect(page).toHaveURL(destination);
  expect(state.creates).toHaveLength(2);
});

test("a timed-out checkout remains uncertain and enables a controlled manual retry", async ({
  page,
}) => {
  const state = await fixture(page);
  const held = deferred();
  state.create = async () => {
    await held.promise;
    return ok({ url: destination, user: null });
  };
  await open(page);
  await page.clock.install();
  await page
    .getByLabel("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await pay(page).first().click();
  await expect.poll(() => state.creates.length).toBe(1);
  await page.clock.fastForward(15_100);
  await expect(page.getByRole("alert").first()).toContainText(
    "Создание ссылки не подтверждено",
  );
  await expect(pay(page).first()).toBeEnabled();
  held.resolve();
  await expect(page).toHaveURL(/\/club$/);
  expect(state.creates).toHaveLength(1);
});

test("leaving the club fences a late payment URL and retains the uncertainty", async ({
  page,
}) => {
  const state = await fixture(page);
  const held = deferred();
  state.create = async () => {
    await held.promise;
    return ok({ url: destination, user: null });
  };
  await open(page);
  await page
    .getByLabel("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await pay(page).first().click();
  await expect(pay(page).first()).toBeDisabled();
  await page.getByRole("link", { name: "Лента", exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
  held.resolve();
  await page.getByRole("link", { name: "Клуб", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Создание ссылки не подтверждено",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await pay(page).first().click();
  expect(state.creates).toHaveLength(1);
  await expect(page).toHaveURL(/\/club$/);
});

test("an account change cannot follow the previous person's payment URL", async ({
  page,
}) => {
  const state = await fixture(page, true, true);
  const held = deferred();
  state.create = async () => {
    await held.promise;
    return ok({ url: destination, user: null });
  };
  await open(page);
  await pay(page).first().click();
  await expect(pay(page).first()).toBeDisabled();
  // Hold an actually dispatched checkout, not just the synchronous busy state.
  await expect.poll(() => state.creates.length).toBe(1);
  state.user = member(102);
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "new-person",
      }),
    ),
  );
  await expect(pay(page).first()).toBeEnabled();
  held.resolve();
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(
    page.getByText("member-102@example.test", { exact: true }),
  ).toBeVisible();
  expect(state.creates).toHaveLength(1);
});

test("a guest return opens the email login path without granting access", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page, "/club?paid=1");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "После оплаты проверьте почту" }),
  ).toBeVisible();
  expect(state.claims).toBe(0);
  expect(state.creates).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Войти для проверки доступа", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("member-101@example.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("Existing-password-123");
  await page.route("**/api/auth/login", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      email: "member-101@example.test",
      password: "Existing-password-123",
    });
    state.user = member();
    state.subscription = {
      ...state.subscription,
      subscribed: true,
      expiresAt: expiration,
    };
    return route.fulfill({ json: { user: state.user } });
  });
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/club$/);
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toBeVisible();
  expect(state.creates).toHaveLength(0);
  expect(page.url()).not.toContain("Existing-password-123");
});

test("claim granted does not open access without a fresh subscription", async ({
  page,
}) => {
  const state = await fixture(page, true);
  state.claim = () => ok({ granted: true, orderId: "unverified" });
  await open(page);
  await check(page).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Оплата пока не подтверждена" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toHaveCount(0);
  expect(state.claims).toBe(1);
  expect(state.creates).toHaveLength(0);
});

test("automatic return checking is finite, sequential and does not create payments", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.clock.install();
  await gotoWithSession(page, "/club?paid=1");
  await expect(
    page.getByRole("button", { name: "Проверяем…", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => state.reads).toBe(2);
  for (let index = 0; index < 5; index++) {
    await page.clock.fastForward(2600);
    await expect.poll(() => state.reads).toBe(3 + index);
  }
  await expect(check(page)).toBeEnabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Оплата пока не подтверждена" }),
  ).toBeVisible();
  const reads = state.reads;
  await page.clock.fastForward(60_000);
  expect(state.reads).toBe(reads);
  expect(state.claims).toBe(1);
  expect(state.creates).toHaveLength(0);
});

test("a confirmed later access period updates renewal without claiming payment success", async ({
  page,
}) => {
  const state = await fixture(page, true, true);
  await open(page, "/club?checkout=1&paid=1");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Текущий доступ до 1 ноября 2040 г." }),
  ).toBeVisible();
  await expect(page.getByText(/Подписка продлена|Оплата успешна/)).toHaveCount(
    0,
  );
  state.subscription.expiresAt = "2040-12-01T10:00:00Z";
  await check(page).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Текущий доступ до 1 декабря 2040 г." }),
  ).toBeVisible();
  await check(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("renewal-confirmed-390.png"),
  });
  expect(state.creates).toHaveLength(0);
  await page
    .locator('[data-tab-screen="/club"] .ui-scroll')
    .first()
    .evaluate((element) => element.scrollTo({ top: 0 }));
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(
    page.getByText("Следующее списание: 1 декабря 2040 г. · 790 ₽ / месяц", {
      exact: true,
    }),
  ).toBeVisible();
});

for (const result of [
  failure(500),
  ok({
    subscribed: "true",
    expiresAt: expiration,
    cancelAtPeriodEnd: false,
    isOwner: false,
    monthlyPrice: "790",
  }),
  ok({
    subscribed: true,
    expiresAt: "invalid",
    cancelAtPeriodEnd: false,
    isOwner: false,
    monthlyPrice: "790",
  }),
]) {
  test(`failed fresh access ${JSON.stringify(result)} cannot grant a subscription`, async ({
    page,
  }) => {
    const state = await fixture(page, true);
    await open(page);
    state.read = () => result;
    await check(page).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Не удалось проверить доступ" }),
    ).toBeVisible();
    await expect(check(page)).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Открыть фильтры клуба" }),
    ).toHaveCount(0);
    state.read = undefined;
    state.subscription = {
      ...state.subscription,
      subscribed: true,
      expiresAt: expiration,
    };
    await check(page).click();
    await expect(
      page.getByRole("button", { name: "Открыть фильтры клуба" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Текущий доступ до" }),
    ).toBeVisible();
    expect(state.creates).toHaveLength(0);
  });
}

test("one pending manual verification disables both check and payment actions", async ({
  page,
}) => {
  const state = await fixture(page, true);
  const held = deferred();
  state.claim = async () => {
    await held.promise;
    return ok({ granted: false, orderId: null });
  };
  await open(page);
  await check(page).click();
  await expect(
    page.getByRole("button", { name: "Проверяем…", exact: true }),
  ).toBeDisabled();
  await expect(pay(page).first()).toBeDisabled();
  await pay(page).first().dispatchEvent("click");
  await page
    .getByRole("button", { name: "Проверяем…", exact: true })
    .dispatchEvent("click");
  await expect.poll(() => state.claims).toBe(1);
  held.resolve();
  await expect(check(page)).toBeEnabled();
  expect(state.creates).toHaveLength(0);
});

test("leaving a return check stops the campaign and does not restart it on tab return", async ({
  page,
}) => {
  const state = await fixture(page, true);
  const held = deferred();
  state.claim = async () => {
    await held.promise;
    return ok({ granted: false, orderId: null });
  };
  await gotoWithSession(page, "/club?paid=1");
  await expect(
    page.getByRole("button", { name: "Проверяем…", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Лента", exact: true }).click();
  held.resolve();
  await page.getByRole("link", { name: "Клуб", exact: true }).click();
  await expect(pay(page).first()).toBeEnabled();
  expect(state.claims).toBe(1);
  expect(state.creates).toHaveLength(0);
});

test("recovery handles malformed replies, rate limits and a valid queued instruction", async ({
  page,
}) => {
  await fixture(page);
  let attempts = 0;
  await page.route("**/api/auth/password/request", (route) => {
    attempts++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      email: "member-101@example.test",
    });
    if (attempts === 1)
      return route.fulfill({
        status: 202,
        json: { ok: false, message: "false-success" },
      });
    if (attempts === 2)
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "2" },
        json: { error: "Слишком много попыток. Попробуйте позже." },
      });
    return route.fulfill({
      status: 202,
      json: {
        ok: true,
        message: "Если аккаунт доступен, мы отправим письмо с инструкцией.",
      },
    });
  });
  await gotoWithSession(page, "/login");
  await page.clock.install();
  await page
    .getByRole("button", { name: "Забыли пароль или ещё не установили его?" })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("member-101@example.test");
  await page
    .getByRole("button", { name: "Отправить инструкцию", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Некорректный ответ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "false-success" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Отправить инструкцию", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Слишком много попыток" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить инструкцию", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(2100);
  await page
    .getByRole("button", { name: "Отправить инструкцию", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Если аккаунт доступен" }),
  ).toBeVisible();
  await expect(page.getByLabel("Пароль", { exact: true })).toBeVisible();
  expect(attempts).toBe(3);
});
