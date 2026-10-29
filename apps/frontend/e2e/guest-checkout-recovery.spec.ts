import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { failure } from "./editor-fixtures";

test.skip(
  process.env.GUEST_CHECKOUT_UI_ENABLED !== "true",
  "Requires a guest LIVE recovery build; all API/payment replies are synthetic.",
);
test.setTimeout(45_000);
const slot = "darcy:guest:normal-checkout:v1";
const saved = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), slot);
const action = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name }).first();
const result = (data: unknown) => ({
  result: { data: superjson.serialize(data) },
});
const user = {
  id: 101,
  openId: "guest-recipient",
  name: "Участница",
  email: "guest@example.test",
  role: "user",
  lastSignedIn: "2026-10-01T12:00:00Z",
};
async function startPurchase(page: Page, name: string | RegExp) {
  await action(page, name).waitFor({ state: "visible" });
  const phone = page.getByRole("textbox", { name: "Номер телефона", exact: true }).first();
  if (await phone.count() && await phone.isEditable() && !(await phone.inputValue())) {
    await phone.fill("+79991234567");
  }
  await action(page, name).click();
}
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
type Input = {
  idempotencyKey: string;
  recoveryToken: string;
  email: string;
  plan: string;
};
type Order = {
  state: "pending" | "succeeded" | "failed";
  orderId: string;
  expiresAt?: Date;
};
async function fixture(page: Page) {
  await layoutApi(page);
  const state = {
    user: null as typeof user | null,
    writes: [] as Input[],
    statuses: [] as { idempotencyKey: string; recoveryToken: string }[],
    orders: new Map<string, Order>(),
    legacy: 0,
    normal: 0,
    loseReply: true,
    rejectCreate: 0,
    rejectStatus: 0,
    notRecorded: false,
    paid: false,
    navigations: [] as string[],
    gate: undefined as Promise<void> | undefined,
  };
  await page.route("https://payments.example.test/**", async (route) => {
    state.navigations.push(route.request().url());
    await route.fulfill({
      contentType: "text/html",
      body: "Synthetic payment destination",
    });
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: state.user } }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    const inputs = JSON.parse(
      route.request().postData() ?? url.searchParams.get("input") ?? "{}",
    );
    let httpStatus = 200;
    const replies = await Promise.all(
      names.map(async (name, index) => {
        const input = url.searchParams.has("batch")
          ? (inputs[index]?.json ?? {})
          : (inputs.json ?? {});
        if (
          name === "club.createGuestNormalCheckout" ||
          name === "club.guestNormalCheckoutStatus"
        ) {
          expect(route.request().method()).toBe("POST");
          expect(url.search).toBe("");
          expect(route.request().headers()).not.toHaveProperty(
            "idempotency-key",
          );
          const encoded = await saved(page);
          expect(encoded).not.toBeNull();
          const evidence = JSON.parse(encoded!);
          expect(evidence).toMatchObject({
            idempotencyKey: input.idempotencyKey,
            recoveryToken: input.recoveryToken,
          });
          expect(input.recoveryToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
          if (name === "club.guestNormalCheckoutStatus") {
            expect(Object.keys(input).sort()).toEqual([
              "idempotencyKey",
              "recoveryToken",
            ]);
            state.statuses.push(input);
            if (state.rejectStatus) {
              httpStatus = state.rejectStatus;
              return failure(httpStatus);
            }
            return result(
              state.notRecorded
                ? { state: "notRecorded" }
                : (state.orders.get(
                    `${input.recoveryToken}:${input.idempotencyKey}`,
                  ) ?? { state: "notRecorded" }),
            );
          }
          state.writes.push(input);
          if (state.rejectCreate) {
            httpStatus = state.rejectCreate;
            return failure(httpStatus);
          }
          const key = `${input.recoveryToken}:${input.idempotencyKey}`;
          let order = state.orders.get(key);
          if (!order) {
            order = {
              state: "pending",
              orderId: `guest-order-${state.orders.size + 1}`,
            };
            state.orders.set(key, order);
          }
          await state.gate;
          if (state.loseReply) {
            await route.abort("failed");
            return result(order);
          }
          return result(
            order.state === "pending"
              ? {
                  ...order,
                  url: `https://payments.example.test/guest/${order.orderId}`,
                }
              : order,
          );
        }
        if (name === "club.createCheckout") {
          state.legacy++;
          return result({
            url: "https://payments.example.test/legacy",
            user: null,
          });
        }
        if (name === "club.createNormalCheckout") {
          state.normal++;
          return failure(500);
        }
        if (name === "club.normalCheckoutStatus")
          return result({ state: "notRecorded" });
        if (name === "club.subscription")
          return result({
            hasClubAccess: state.paid,
            subscribed: state.paid,
            expiresAt: state.paid ? new Date("2040-12-01") : null,
            cancelAtPeriodEnd: false,
            cancellationStatus: "none",
            isOwner: false,
            monthlyPrice: "790",
          });
        if (name === "feed.interactionsForPosts")
          return result({ likedIds: [], savedIds: [] });
        if (name === "feed.listPaginated" || name === "club.listByCategory")
          return result({ posts: [], nextCursor: null });
        if (name === "notifications.latest")
          return result({ feedId: null, clubId: null });
        return result([]);
      }),
    );
    await route
      .fulfill({
        status: httpStatus,
        headers: httpStatus === 429 ? { "Retry-After": "2" } : {},
        json: url.searchParams.has("batch") ? replies : replies[0],
      })
      .catch(() => {});
  });
  return state;
}
async function loseCheckout(page: Page) {
  await gotoWithSession(page, "/club?checkout=1");
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await startPurchase(page, /Оплатить 790/);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(action(page, "Восстановить ссылку оплаты")).toBeEnabled();
}
test("lost response and reload preserve proof; status never creates another order; manual replay restores its URL", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const before = JSON.parse((await saved(page))!);
  await page.reload();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Оплата этой покупки пока не подтверждена" }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("Почта для чека и входа").first(),
  ).toHaveValue(user.email);
  await expect(
    page.getByPlaceholder("Почта для чека и входа").first(),
  ).toHaveAttribute("readonly", "");
  expect(state.writes).toHaveLength(1);
  expect(state.orders.size).toBe(1);
  expect(JSON.parse((await saved(page))!)).toMatchObject(before);
  state.loseReply = false;
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(page).toHaveURL(
    "https://payments.example.test/guest/guest-order-1",
  );
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.legacy).toBe(0);
});
test("notRecorded cannot rotate an unknown committed purchase", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  state.notRecorded = true;
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(
    state.writes.every(
      (item) => JSON.stringify(item) === JSON.stringify(state.writes[0]),
    ),
  ).toBe(true);
  expect(state.orders.size).toBe(1);
});
for (const status of [409, 412, 500])
  test(`HTTP ${status} preserves the same proof and never falls back`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.rejectCreate = status;
    await loseCheckout(page);
    const before = await saved(page);
    await action(page, "Восстановить ссылку оплаты").click();
    await expect.poll(() => state.writes.length).toBe(2);
    expect(state.writes[1]).toEqual(state.writes[0]);
    expect(await saved(page)).toBe(before);
    expect(state.legacy + state.normal).toBe(0);
  });
test("storage refusal prevents every checkout/status call and retains the entered email", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/club");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await startPurchase(page, /Оплатить 790/);
  await expect(page.getByRole("alert").first()).toContainText("не начата");
  await expect(
    page.getByPlaceholder("Почта для чека и входа").first(),
  ).toHaveValue(user.email);
  expect(state.writes.length + state.statuses.length + state.legacy).toBe(0);
});
test("429 persists its pause through reload; time alone does not retry a password or purchase", async ({
  page,
}) => {
  const state = await fixture(page);
  state.rejectCreate = 429;
  await gotoWithSession(page, "/club");
  await page.clock.install();
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await startPurchase(page, /Оплатить 790/);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect
    .poll(async () => JSON.parse((await saved(page)) ?? "null")?.retryAt ?? 0)
    .toBeGreaterThan(0);
  await expect(action(page, "Восстановить ссылку оплаты")).toBeDisabled();
  const before = JSON.parse((await saved(page))!);
  expect(before.retryAt).toBeGreaterThan(0);
  await page.reload();
  await expect(action(page, "Восстановить ссылку оплаты")).toBeDisabled();
  const reads = state.statuses.length;
  await page.clock.fastForward(3000);
  await expect(action(page, "Восстановить ссылку оплаты")).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(state.statuses).toHaveLength(reads);
  state.rejectCreate = 0;
  await action(page, "Восстановить ссылку оплаты").click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
test("login with the recipient resumes the guest purchase instead of preparing a NORMAL order", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const before = JSON.parse((await saved(page))!);
  state.user = user;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(async () => JSON.parse((await saved(page))!).ownerId)
    .toBe(user.id);
  await action(page, "Восстановить ссылку оплаты").click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(JSON.parse((await saved(page))!)).toMatchObject({
    idempotencyKey: before.idempotencyKey,
    recoveryToken: before.recoveryToken,
  });
  expect(state.normal + state.legacy).toBe(0);
});

test("after login a notRecorded guest result keeps its proof and never starts a NORMAL replacement", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  state.user = user;
  state.notRecorded = true;
  const before = await saved(page);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Создание покупки пока не подтверждено" }),
  ).toBeVisible();
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(page.getByRole("alert").first()).toContainText(
    "пока не найдена",
  );
  expect(await saved(page)).toBe(before);
  expect(state.writes).toHaveLength(1);
  expect(state.normal + state.legacy).toBe(0);
});

test("a terminal guest purchase is retained after login until an explicit fresh check hands off to NORMAL", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const first = state.writes[0];
  state.orders.set(`${first.recoveryToken}:${first.idempotencyKey}`, {
    state: "failed",
    orderId: "guest-order-1",
  });
  state.user = user;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const next = action(page, "Перейти к новой покупке своего аккаунта");
  await expect(next).toBeEnabled();
  const reads = state.statuses.length;
  expect(await saved(page)).not.toBeNull();
  await page.getByRole("textbox", { name: "Номер телефона", exact: true }).first().fill("+79991234567");
  await next.click();
  await expect(action(page, /Оплатить 790/)).toBeEnabled();
  expect(state.statuses.length).toBeGreaterThan(reads);
  expect(await saved(page)).toBeNull();
  expect(state.normal).toBe(0);
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.normal).toBe(1);
  expect(state.writes).toHaveLength(1);
  expect(state.legacy).toBe(0);
});
test("a different account cannot see the recipient, dispatch its proof, or receive a late payment URL", async ({
  page,
}) => {
  const state = await fixture(page);
  state.loseReply = false;
  const gate = deferred();
  state.gate = gate.promise;
  await gotoWithSession(page, "/club");
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.writes.length).toBe(1);
  const before = await saved(page);
  const reads = state.statuses.length;
  state.user = {
    ...user,
    id: 102,
    openId: "other-account",
    email: "other@example.test",
  };
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("status").filter({ hasText: "другого получателя" }).first(),
  ).toBeVisible();
  gate.resolve();
  await expect(action(page, /Оплатить 790/)).toBeEnabled();
  expect(await saved(page)).toBe(before);
  expect(state.statuses).toHaveLength(reads);
  expect(state.navigations).toHaveLength(0);
  expect(state.normal + state.legacy).toBe(0);
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.normal).toBe(1);
  expect(await saved(page)).toBe(before);
  expect(state.statuses).toHaveLength(reads);
});
test("guest success does not log in or grant access; a fresh terminal check is required for a new recipient", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const first = state.writes[0];
  state.orders.set(`${first.recoveryToken}:${first.idempotencyKey}`, {
    state: "succeeded",
    orderId: "guest-order-1",
    expiresAt: new Date("2040-11-01"),
  });
  await action(page, "Проверить покупку").click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Подтверждение оплаты не выполняет вход" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toHaveCount(0);
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill("second@example.test");
  const reads = state.statuses.length;
  await startPurchase(page, "Новая покупка подписки");
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.statuses.length).toBeGreaterThan(reads);
  expect(state.writes[1].email).toBe("second@example.test");
  expect(state.writes[1].idempotencyKey).not.toBe(first.idempotencyKey);
  expect(state.writes[1].recoveryToken).not.toBe(first.recoveryToken);
});
test("missing evidence after an unknown result stays blocked, including subsequent manual checks", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  await page.evaluate((key) => localStorage.removeItem(key), slot);
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(page.getByRole("alert").first()).toContainText(
    "ключ восстановления",
  );
  await action(page, "Проверить покупку").click();
  await expect(action(page, "Восстановить ссылку оплаты")).toBeEnabled();
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(action(page, "Восстановить ссылку оплаты")).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(state.legacy + state.normal).toBe(0);
});
test("a return without proof never creates a purchase and requires explicit confirmation before starting another", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/club?paid=1");
  await expect(
    page.getByRole("status").filter({ hasText: "нет ключей" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await startPurchase(page, /Оплатить 790/);
  await expect(action(page, /Оплатить 790/)).toBeEnabled();
  expect(state.writes.length + state.statuses.length).toBe(0);
});
test("leaving checkout cancels a late redirect while keeping recovery evidence", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.loseReply = false;
  state.gate = gate.promise;
  await gotoWithSession(page, "/club");
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.writes.length).toBe(1);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Лента", exact: true })
    .click();
  gate.resolve();
  await expect(page).toHaveURL(/\/feed$/);
  expect(state.navigations).toHaveLength(0);
  expect(await saved(page)).not.toBeNull();
});

test("two tabs share one guest intent without a loop of status requests", async ({
  page,
  context,
}) => {
  const state = await fixture(page);
  const second = await context.newPage();
  const other = await fixture(second);
  other.orders = state.orders;
  other.writes = state.writes;
  other.statuses = state.statuses;
  await Promise.all([
    gotoWithSession(page, "/club"),
    gotoWithSession(second, "/club"),
  ]);
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await second
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await Promise.all([
    startPurchase(page, /Оплатить 790/),
    startPurchase(second, /Оплатить 790/),
  ]);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(second.getByRole("alert").first()).toBeVisible();
  await expect.poll(() => state.orders.size).toBe(1);
  expect(state.writes.length).toBeGreaterThan(0);
  expect(
    state.writes.every(
      (input) => JSON.stringify(input) === JSON.stringify(state.writes[0]),
    ),
  ).toBe(true);
  const reads = state.statuses.length;
  // A no-op journal acknowledgement must not bounce storage events between tabs.
  await page.waitForTimeout(500);
  expect(state.statuses).toHaveLength(reads);
  await second.close();
});

test("a client timeout retains the keys and checks the committed order without reopening payment", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.gate = gate.promise;
  state.loseReply = false;
  await gotoWithSession(page, "/club");
  await page.clock.install();
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill(user.email);
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.writes.length).toBe(1);
  const before = await saved(page);
  await page.clock.fastForward(15000);
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(await saved(page)).toBe(before);
  gate.resolve();
  await action(page, "Проверить покупку").click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Оплата этой покупки пока не подтверждена" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.navigations).toHaveLength(0);
});
