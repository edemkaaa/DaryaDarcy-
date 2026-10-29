import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { failure } from "./editor-fixtures";

test.skip(
  process.env.NORMAL_CHECKOUT_UI_ENABLED !== "true",
  "Requires a locally built NORMAL recovery variant; uses synthetic API only.",
);
test.setTimeout(45_000);
const slot = (owner = 101) => `darcy:user:${owner}:normal-checkout:v1`;
const saved = (page: Page, owner = 101) =>
  page.evaluate((name) => localStorage.getItem(name), slot(owner));
const action = (page: Page, name: RegExp | string) =>
  page.getByRole("button", { name }).first();
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
const result = (data: unknown) => ({
  result: { data: superjson.serialize(data) },
});
const defaultUser = {
  id: 101,
  openId: "normal-member",
  name: "Участница",
  email: "member@example.test",
  role: "user",
  lastSignedIn: "2026-10-01T12:00:00Z",
};
type Order = {
  state: "pending" | "succeeded" | "failed";
  orderId: string;
  expiresAt?: Date;
};
async function fixture(page: Page, paid = false) {
  await layoutApi(page, true);
  const state = {
    user: { ...defaultUser } as typeof defaultUser | null,
    paid,
    writes: [] as { idempotencyKey: string; plan: string }[],
    statuses: [] as { key: string; owner: number | undefined }[],
    legacyWrites: 0,
    navigations: [] as string[],
    orders: new Map<string, Order>(),
    loseReply: true,
    rejectCreate: 0,
    forceNotRecorded: false,
    createGate: undefined as Promise<void> | undefined,
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
    const replies = await Promise.all(
      names.map(async (name, index) => {
        const input = url.searchParams.has("batch")
          ? (inputs[index]?.json ?? {})
          : (inputs.json ?? {});
        if (name === "club.subscription")
          return result({
            hasClubAccess: state.paid,
            subscribed: state.paid,
            expiresAt: state.paid ? new Date("2040-12-01T10:00:00Z") : null,
            cancelAtPeriodEnd: false,
            cancellationStatus: "none",
            isOwner: false,
            monthlyPrice: "790",
          });
        if (name === "club.normalCheckoutStatus") {
          expect(route.request().method()).toBe("GET");
          state.statuses.push({
            key: input.idempotencyKey,
            owner: state.user?.id,
          });
          const order = state.orders.get(
            `${state.user?.id}:${input.idempotencyKey}`,
          );
          return result(
            state.forceNotRecorded
              ? { state: "notRecorded" }
              : (order ?? { state: "notRecorded" }),
          );
        }
        if (name === "club.createNormalCheckout") {
          expect(route.request().method()).toBe("POST");
          expect(route.request().headers()).not.toHaveProperty(
            "idempotency-key",
          );
          expect(Object.keys(input).sort()).toEqual(["idempotencyKey", "plan"]);
          expect(input.idempotencyKey).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          );
          const encoded = await saved(page, state.user?.id);
          expect(encoded).not.toBeNull();
          expect(JSON.parse(encoded!)).toMatchObject({
            idempotencyKey: input.idempotencyKey,
            plan: input.plan,
            ownerId: state.user?.id,
          });
          state.writes.push(input);
          if (state.rejectCreate) return failure(state.rejectCreate);
          const key = `${state.user?.id}:${input.idempotencyKey}`;
          let order = state.orders.get(key);
          if (!order) {
            order = {
              state: "pending",
              orderId: `normal-order-${state.orders.size + 1}`,
            };
            state.orders.set(key, order);
          }
          const snapshot = { ...order };
          await state.createGate;
          if (state.loseReply) {
            await route.abort("failed");
            return result(snapshot);
          }
          return result(
            snapshot.state === "pending"
              ? {
                  ...snapshot,
                  url: `https://payments.example.test/normal/${snapshot.orderId}`,
                }
              : snapshot,
          );
        }
        if (name === "club.createCheckout") {
          state.legacyWrites++;
          return result({
            url: "https://payments.example.test/guest",
            user: null,
          });
        }
        if (name === "club.claimPending" || name === "club.reconcileCheckout")
          throw new Error("NORMAL must not use TEST/legacy payment proof");
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
      .fulfill({ json: url.searchParams.has("batch") ? replies : replies[0] })
      .catch(() => {});
  });
  return state;
}
async function loseCheckout(page: Page) {
  await gotoWithSession(page, "/club?checkout=1");
  await startPurchase(page, /Оплатить 790/);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(action(page, "Восстановить ссылку оплаты")).toBeEnabled();
}

test("lost response and reload restore the same pending order; status does not create another one", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const first = await saved(page);
  await page.reload();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Оплата этой покупки пока не подтверждена" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.orders.size).toBe(1);
  expect(JSON.parse((await saved(page))!).idempotencyKey).toBe(
    JSON.parse(first!).idempotencyKey,
  );
  expect(state.navigations).toHaveLength(0);
  expect(state.legacyWrites).toBe(0);
});

test("explicit recovery obtains the original payment URL with the same key and plan", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  state.loseReply = false;
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(page).toHaveURL(
    "https://payments.example.test/normal/normal-order-1",
  );
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.orders.size).toBe(1);
});

test("notRecorded is a snapshot and never rotates the key after a late commit", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const key = JSON.parse((await saved(page))!).idempotencyKey;
  state.forceNotRecorded = true;
  await action(page, "Восстановить ссылку оплаты").click();
  // A notRecorded snapshot cannot authorize a different key or a second order.
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(JSON.parse((await saved(page))!).idempotencyKey).toBe(key);
  expect(state.orders.size).toBe(1);
  expect(state.writes.every((input) => input.idempotencyKey === key)).toBe(
    true,
  );
});

test("an existing paid subscription and payment return do not confirm the new pending purchase", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await loseCheckout(page);
  await page.goto("/club?paid=1");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Оплата этой покупки пока не подтверждена" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Оплата этой покупки подтверждена", { exact: false }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

test("succeeded uses this order's Date; an expired historical purchase does not open current club access", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const original = state.writes[0];
  state.orders.set(`101:${original.idempotencyKey}`, {
    state: "succeeded",
    orderId: "normal-order-1",
    expiresAt: new Date("2020-11-01T10:00:00Z"),
  });
  await action(page, "Проверить покупку").click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Оплата этой покупки подтверждена.*2020/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

test("failed allows a deliberate new purchase only after fresh terminal verification", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  const original = state.writes[0];
  state.orders.set(`101:${original.idempotencyKey}`, {
    state: "failed",
    orderId: "normal-order-1",
  });
  await action(page, "Проверить покупку").click();
  await expect(action(page, "Новая покупка подписки")).toBeEnabled();
  const reads = state.statuses.length;
  await startPurchase(page, "Новая покупка подписки");
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.statuses.length).toBeGreaterThan(reads);
  expect(state.writes[1].idempotencyKey).not.toBe(original.idempotencyKey);
  expect(state.orders.size).toBe(2);
});

for (const status of [409, 412]) {
  test(`HTTP ${status} preserves the original purchase and never falls back to an unkeyed order`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.rejectCreate = status;
    await loseCheckout(page);
    const original = await saved(page);
    await action(page, "Восстановить ссылку оплаты").click();
    await expect.poll(() => state.writes.length).toBe(2);
    expect(await saved(page)).toBe(original);
    expect(state.writes[1]).toEqual(state.writes[0]);
    expect(state.legacyWrites).toBe(0);
    expect(state.orders.size).toBe(0);
  });
}

test("return without saved evidence does not create a purchase or infer success from active access", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await gotoWithSession(page, "/club?paid=1");
  await expect(
    page.getByRole("status").filter({
      hasText: "Возврат с сайта оплаты не подтверждает новую оплату",
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.statuses).toHaveLength(0);
  expect(await saved(page)).toBeNull();
});

test("a late payment URL cannot navigate after leaving the purchase page", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.loseReply = false;
  state.createGate = gate.promise;
  await gotoWithSession(page, "/club?checkout=1");
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

test("an explicit check can recover after a navigation attempt without reviving its cancelled redirect", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.loseReply = false;
  state.createGate = gate.promise;
  await gotoWithSession(page, "/club?checkout=1");
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("darcy:navigation-start", { detail: "/feed" }),
    ),
  );
  gate.resolve();
  await action(page, "Проверить покупку").click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Оплата этой покупки пока не подтверждена" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.orders.size).toBe(1);
  expect(state.navigations).toHaveLength(0);
  expect(await saved(page)).not.toBeNull();
});

test("a late payment URL cannot enter the next account or bind its order", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.loseReply = false;
  state.createGate = gate.promise;
  await gotoWithSession(page, "/club?checkout=1");
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.writes.length).toBe(1);
  state.user = { ...defaultUser, id: 102, openId: "second-member" };
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("status").filter({ hasText: "Нет сохранённой покупки" }),
  ).toBeVisible();
  gate.resolve();
  await expect(action(page, /Оплатить 790/)).toBeEnabled();
  expect(await saved(page, 102)).toBeNull();
  expect(state.navigations).toHaveLength(0);
  expect(state.statuses.filter((item) => item.owner === 102)).toHaveLength(0);
});

test("guests keep the existing checkout even when the NORMAL integration build is enabled", async ({
  page,
}) => {
  test.skip(
    process.env.GUEST_CHECKOUT_UI_ENABLED === "true",
    "Guest recovery has its own opt-in and contract suite.",
  );
  const state = await fixture(page);
  state.user = null;
  await gotoWithSession(page, "/club");
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await startPurchase(page, /Оплатить 790/);
  await expect(page).toHaveURL("https://payments.example.test/guest");
  expect(state.legacyWrites).toBe(1);
  expect(state.writes).toHaveLength(0);
  expect(state.statuses).toHaveLength(0);
});

test("a real client timeout retains one order and its key; checking afterwards never reopens payment", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.loseReply = false;
  state.createGate = gate.promise;
  await gotoWithSession(page, "/club?checkout=1");
  await page.clock.install();
  await startPurchase(page, /Оплатить 790/);
  await expect.poll(() => state.writes.length).toBe(1);
  const original = await saved(page);
  await page.clock.fastForward(15_000);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Результат покупки не подтверждён" })
      .first(),
  ).toBeVisible();
  expect(await saved(page)).toBe(original);
  gate.resolve();
  await action(page, "Проверить покупку").click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Оплата этой покупки пока не подтверждена" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.orders.size).toBe(1);
  expect(state.navigations).toHaveLength(0);
});

test("missing browser evidence cannot replace a known outstanding purchase even after a failed check", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCheckout(page);
  await page.evaluate((name) => localStorage.removeItem(name), slot());
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await action(page, "Проверить покупку").click();
  await expect(action(page, "Восстановить ссылку оплаты")).toBeEnabled();
  await action(page, "Восстановить ссылку оплаты").click();
  await expect(action(page, "Восстановить ссылку оплаты")).toBeEnabled();
  expect(await saved(page)).toBeNull();
  expect(state.writes).toHaveLength(1);
  expect(state.orders.size).toBe(1);
  expect(state.legacyWrites).toBe(0);
});
