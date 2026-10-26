import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const payment = (id: number) => ({
  id,
  userId: 201,
  orderId: `ORDER_${id}`,
  email: `PAYMENT_${id}@example.test`,
  sum: "1500.00",
  status: "paid",
  paidAt: "2026-10-01T00:00:00Z",
  expiresAt: "2026-11-01T00:00:00Z",
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
});

test("changing administrator starts a new history and discards the old pending page", async ({
  page,
}) => {
  let owner = 101;
  const reads: { owner: number; cursor: unknown }[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await editorApi(page, async (name, input) => {
    if (name !== "admin.paymentsPage") return;
    reads.push({ owner, cursor: input.cursor });
    if (input.cursor) {
      await held;
      return ok({ items: [payment(21)], nextCursor: null });
    }
    return ok({
      items:
        owner === 101
          ? Array.from({ length: 20 }, (_, i) => payment(i + 1))
          : [payment(100)],
      nextCursor: owner === 101 ? "first-owner-cursor" : null,
    });
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: owner,
          openId: `admin-${owner}`,
          name: "Администратор",
          role: "admin",
          email: "admin@example.test",
          lastSignedIn: "2026-10-04T10:00:00Z",
        },
      },
    }),
  );
  try {
    await open(page);
    await expect(rows(page)).toHaveCount(20);
    await scrollEnd(page);
    await expect.poll(() => reads.length).toBe(2);
    owner = 202;
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "second-owner",
        }),
      ),
    );
    await page.getByRole("button", { name: "Оплаты", exact: true }).click();
    await expect(
      page.getByText("PAYMENT_100@example.test", { exact: true }),
    ).toBeVisible();
    release();
    await expect(rows(page)).toHaveCount(1);
    expect(reads).toEqual([
      { owner: 101, cursor: null },
      { owner: 101, cursor: "first-owner-cursor" },
      { owner: 202, cursor: null },
    ]);
  } finally {
    release();
  }
});

test("a confirmed club grant invalidates the new payment history cache", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-26T10:00:00Z") });
  let granted = false;
  let reads = 0;
  const expiresAt = "2027-01-15T10:00:00Z";
  await editorApi(page, (name) => {
    if (name === "admin.paymentsPage") {
      reads++;
      return ok({
        items: granted ? [payment(2), payment(1)] : [payment(1)],
        nextCursor: null,
      });
    }
    if (name === "admin.members")
      return ok([
        {
          id: 201,
          name: "Участница",
          email: "member@example.test",
          role: "user",
          createdAt: "2026-10-01T00:00:00Z",
          blockedAt: null,
          blockedReason: null,
          clubExpiresAt: granted ? expiresAt : null,
        },
      ]);
    if (name === "admin.grantClub") {
      granted = true;
      return ok({ ok: true, expiresAt });
    }
  });
  page.on("dialog", (dialog) => dialog.accept());
  await open(page);
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page.getByRole("button", { name: "Выдать клуб", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Продлить клуб", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Оплаты", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  expect(reads).toBe(2);
});
const rows = (page: Page) =>
  page.getByText(/^PAYMENT_\d+@example\.test$/, { exact: true });
const list = (page: Page) => page.locator("main .ui-scroll").last();
const scrollEnd = (page: Page) =>
  list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
async function refresh(page: Page) {
  await list(page).evaluate((node) => {
    node.scrollTop = 0;
    for (const [type, property, y] of [
      ["touchstart", "touches", 0],
      ["touchend", "changedTouches", 200],
    ] as const) {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, property, {
        value: [{ identifier: 1, target: node, clientY: y }],
      });
      if (type === "touchend")
        Object.defineProperty(event, "touches", { value: [] });
      node.dispatchEvent(event);
    }
  });
}
async function open(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Оплаты", exact: true }).click();
}
async function fixture(page: Page, count = 65) {
  const state = {
    records: Array.from({ length: count }, (_, i) => payment(count - i)),
    reads: [] as (string | null)[],
    legacy: 0,
    status: 0,
    hold: null as Promise<void> | null,
  };
  const cursors = new Map<string, number>();
  await editorApi(page, async (name, input) => {
    if (name === "admin.payments") {
      state.legacy++;
      return ok(state.records.slice(0, 50));
    }
    if (name !== "admin.paymentsPage") return;
    expect(input.limit).toBe(20);
    const cursor = (input.cursor ?? null) as string | null;
    state.reads.push(cursor);
    await state.hold;
    if (state.status) return failure(state.status);
    // Same-date records use the ID tiebreaker. Tokens stay opaque to the UI,
    // and do not depend on a boundary row still existing on the server.
    const boundary = cursor ? cursors.get(cursor) : Infinity;
    expect(boundary).toBeDefined();
    const remaining = state.records.filter((row) => row.id < boundary!);
    const items = remaining.slice(0, 20);
    const nextCursor =
      remaining.length > 20 ? `opaque-payment-token-${items.at(-1)!.id}` : null;
    if (nextCursor) cursors.set(nextCursor, items.at(-1)!.id);
    return ok({ items, nextCursor });
  });
  return state;
}

for (const count of [0, 20, 51, 65]) {
  test(`${count} payments load in bounded pages with equal timestamps`, async ({
    page,
  }) => {
    const state = await fixture(page, count);
    await open(page);
    await expect(rows(page)).toHaveCount(Math.min(count, 20));
    if (!count)
      await expect(
        page.getByText("Оплат пока нет", { exact: true }),
      ).toBeVisible();
    for (let loaded = 20; loaded < count; loaded += 20) {
      await scrollEnd(page);
      await expect(rows(page)).toHaveCount(Math.min(count, loaded + 20));
    }
    expect(await rows(page).allTextContents()).toEqual(
      state.records.map((row) => row.email),
    );
    expect(state.legacy).toBe(0);
    expect(state.reads).toEqual([
      null,
      ...Array.from(
        { length: Math.max(0, Math.ceil(count / 20) - 1) },
        (_, i) => `opaque-payment-token-${count - (i + 1) * 20 + 1}`,
      ),
    ]);
  });
}

test("a deleted boundary and a new payment do not skip old records; refresh starts a new chain", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await expect(rows(page)).toHaveCount(20);
  state.records = [
    payment(66),
    ...state.records.filter((row) => row.id !== 46),
  ];
  await scrollEnd(page);
  await expect(rows(page)).toHaveCount(40);
  await expect(
    page.getByText("PAYMENT_26@example.test", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("PAYMENT_66@example.test", { exact: true }),
  ).toHaveCount(0);
  await refresh(page);
  await expect(rows(page)).toHaveCount(20);
  await expect(
    page.getByText("PAYMENT_66@example.test", { exact: true }),
  ).toBeVisible();
  expect(state.reads).toEqual([null, "opaque-payment-token-46", null]);
});

test("failed next page retains payments and retries the same cursor", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await expect(rows(page)).toHaveCount(20);
  state.status = 400;
  await scrollEnd(page);
  await expect(
    page.getByText("Не удалось загрузить следующие оплаты", { exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(20);
  state.status = 0;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(rows(page)).toHaveCount(40);
  expect(state.reads).toEqual([
    null,
    "opaque-payment-token-46",
    "opaque-payment-token-46",
  ]);
});

test("failed refresh keeps all confirmed pages until a successful first-page retry", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await expect(rows(page)).toHaveCount(20);
  await scrollEnd(page);
  await expect(rows(page)).toHaveCount(40);
  let release!: () => void;
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.status = 400;
  await refresh(page);
  await expect.poll(() => state.reads.length).toBe(3);
  await expect(rows(page)).toHaveCount(40);
  release();
  await expect(
    page.getByText("Не удалось обновить историю оплат", { exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(40);
  state.hold = null;
  state.status = 0;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(rows(page)).toHaveCount(20);
  expect(state.reads).toEqual([null, "opaque-payment-token-46", null, null]);
});

test("forbidden next page hides retained payment records", async ({ page }) => {
  const state = await fixture(page);
  await open(page);
  await expect(rows(page)).toHaveCount(20);
  state.status = 403;
  await scrollEnd(page);
  await expect(rows(page)).toHaveCount(0);
  await expect(
    page.getByText("Не удалось загрузить список", { exact: true }),
  ).toBeVisible();
  state.status = 0;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(rows(page)).toHaveCount(20);
  expect(state.reads).toEqual([null, "opaque-payment-token-46", null]);
});

test("payment history does not poll, and a late page after changing tabs is discarded", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  await open(page);
  await expect(rows(page)).toHaveCount(20);
  await page.clock.fastForward(65_000);
  expect(state.reads).toEqual([null]);
  let release!: () => void;
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await scrollEnd(page);
  await expect.poll(() => state.reads.length).toBe(2);
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  release();
  state.hold = null;
  await page.getByRole("button", { name: "Оплаты", exact: true }).click();
  await expect(rows(page)).toHaveCount(20);
  await scrollEnd(page);
  await expect(rows(page)).toHaveCount(40);
  expect(state.reads.filter((cursor) => cursor !== null)).toEqual([
    "opaque-payment-token-46",
    "opaque-payment-token-46",
  ]);
});
