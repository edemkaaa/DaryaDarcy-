import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { createHmac } from "node:crypto";
import {
  createConnection,
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";
import superjson from "superjson";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request,
} from "@playwright/test";

// Existing Nest/JWT/SQL only. Requests may be dropped before delivery or after
// a committed response. No API response is fabricated, no provider is contacted.
const file = process.env.DARYADARCY_EDITOR_FIXTURE_FILE;
test.skip(
  !file,
  "Requires pnpm test:checkout:real and its disposable database.",
);
type Fixture = {
  databaseUrl: string;
  origin: string;
  password: string;
  profile: string;
};
type Mode = "NORMAL" | "GUEST";
type Intent = {
  idempotencyKey: string;
  recoveryToken?: string;
  orderId?: string;
  ownerId: number | null;
};
type Write = { input: Record<string, unknown>; orderId: string; url: string };
let fixture: Fixture;
let connection: Connection;
let forbidden: string[];
const extraContexts: BrowserContext[] = [];
const slot = (mode: Mode) =>
  mode === "NORMAL"
    ? "darcy:user:503:normal-checkout:v1"
    : "darcy:guest:normal-checkout:v1";
const endpoint = (mode: Mode) =>
  mode === "NORMAL"
    ? "club.createNormalCheckout"
    : "club.createGuestNormalCheckout";
const rows = async (sql: string, values: unknown[] = []) =>
  (await connection.query<RowDataPacket[]>(sql, values))[0];
const stored = (page: Page, mode: Mode): Promise<Intent> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), slot(mode));
const pay = (page: Page, label = "Оплатить 790 ₽") =>
  page.getByRole("button", { name: label, exact: true }).first();
const notice = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text }).first();
const restore = (page: Page) => pay(page, "Восстановить ссылку оплаты");

test.beforeAll(async () => {
  if (!file || !basename(dirname(file)).startsWith("darcy-editor-acceptance-"))
    throw new Error("Owned fixture required");
  fixture = JSON.parse(readFileSync(file, "utf8"));
  const db = new URL(fixture.databaseUrl);
  if (
    fixture.profile !== "checkout" ||
    db.protocol !== "mysql:" ||
    db.hostname !== "127.0.0.1" ||
    db.pathname !== "/backend_test" ||
    db.search ||
    db.hash ||
    new URL(fixture.origin).hostname !== "127.0.0.1"
  )
    throw new Error("Only owned NORMAL/GUEST loopback fixture allowed");
  connection = await createConnection({
    uri: fixture.databaseUrl,
    timezone: "Z",
  });
});
test.beforeEach(async ({ context }) => {
  forbidden = [];
  for (const table of [
    "billing_receipts",
    "billing_profiles",
    "normal_checkout_requests",
    "access_email_outbox",
    "password_tokens",
    "club_payments",
  ])
    await connection.query(`DELETE FROM ${table}`);
  await prepare(context);
});
test.afterEach(async () => {
  for (const context of extraContexts.splice(0)) await context.close();
  expect(forbidden).toEqual([]);
});
test.afterAll(async () => {
  await connection?.end();
});

async function prepare(context: BrowserContext) {
  await context.setExtraHTTPHeaders({ Origin: fixture.origin });
  await context.addInitScript(() => {
    if (!location.protocol.startsWith("http")) return;
    localStorage.setItem("@darcy_install_guide_seen", "1");
    for (const id of [503, 504])
      localStorage.setItem(
        `darcy:user:${id}:@darcy_club_profile_completed`,
        "true",
      );
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === fixture.origin
      ? route.continue()
      : route.abort(),
  );
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /club\.(createCheckout|claimPending|reconcileCheckout)|\/api\/prodamus\/test\//.test(
        url.pathname,
      )
    )
      forbidden.push(url.pathname);
    if (
      /club\.(createGuestNormalCheckout|guestNormalCheckoutStatus)/.test(
        url.pathname,
      ) &&
      (request.method() !== "POST" ||
        url.searchParams.has("batch") ||
        url.searchParams.has("input"))
    )
      forbidden.push("guest-proof-in-url-or-batch");
  });
  context.on("page", (page) => page.on("dialog", (dialog) => dialog.accept()));
}
async function login(context: BrowserContext, id = 503) {
  const result = await context.request.post(
    `${fixture.origin}/api/auth/login`,
    {
      headers: { Origin: fixture.origin },
      data: { email: `buyer${id}@example.test`, password: fixture.password },
    },
  );
  expect(result.status()).toBe(200);
}
async function open(page: Page, mode: Mode) {
  if (mode === "NORMAL") await login(page.context());
  await page.goto("/club?checkout=1");
  await expect(pay(page)).toBeEnabled();
  if (mode === "GUEST")
    await page
      .getByPlaceholder("Почта для чека и входа")
      .first()
      .fill("buyer503@example.test");
  await page
    .getByRole("textbox", { name: "Номер телефона", exact: true })
    .first()
    .fill("+79991234567");
}
function input(request: Request, name: string): Record<string, unknown> {
  const url = new URL(request.url());
  const names = url.pathname.split("/api/trpc/")[1].split(",");
  const values = JSON.parse(request.postData() ?? "{}");
  return url.searchParams.has("batch")
    ? values[names.indexOf(name)].json
    : values.json;
}
async function loseReply(
  page: Page,
  mode: Mode,
  writes: Write[],
  afterCommit = true,
) {
  await page.route(`**/api/trpc/**${endpoint(mode)}**`, async (route) => {
    const request = route.request();
    const value = input(request, endpoint(mode));
    const saved = await stored(page, mode);
    expect(value.idempotencyKey).toBe(saved.idempotencyKey);
    if (mode === "GUEST") expect(value.recoveryToken).toBe(saved.recoveryToken);
    if (!afterCommit) {
      await route.abort("failed");
      return;
    }
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const body = await response.json();
    const result = superjson.deserialize<{
      state: string;
      orderId: string;
      url: string;
    }>((Array.isArray(body) ? body[0] : body).result.data);
    expect(result.state).toBe("pending");
    expect(new URL(result.url).hostname).toBe("fixture.payform.ru");
    expect(new URL(result.url).searchParams.get("order_id")).toBe(
      result.orderId,
    );
    expect(
      await rows(
        "SELECT orderId FROM normal_checkout_requests WHERE orderId=?",
        [result.orderId],
      ),
    ).toHaveLength(1);
    writes.push({ input: value, orderId: result.orderId, url: result.url });
    await route.abort("failed");
  });
}
async function pending(page: Page) {
  await expect(restore(page)).toBeEnabled();
}
async function exactlyOneOrder() {
  expect(
    await rows("SELECT orderId FROM normal_checkout_requests"),
  ).toHaveLength(1);
  expect(
    await rows("SELECT orderId FROM club_payments WHERE status='pending'"),
  ).toHaveLength(1);
}

for (const mode of ["NORMAL", "GUEST"] as const) {
  test(`${mode}: lost committed reply and reload reuse the original order and keys`, async ({
    page,
  }) => {
    const writes: Write[] = [];
    await open(page, mode);
    await loseReply(page, mode, writes);
    await pay(page).click();
    await pending(page);
    expect(writes).toHaveLength(1);
    const first = await stored(page, mode);
    await page.reload();
    await expect(
      notice(page, "Оплата этой покупки пока не подтверждена"),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    expect((await stored(page, mode)).idempotencyKey).toBe(
      first.idempotencyKey,
    );
    if (mode === "GUEST")
      expect((await stored(page, mode)).recoveryToken).toBe(
        first.recoveryToken,
      );
    await restore(page).click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1]).toEqual(writes[0]);
    await exactlyOneOrder();
  });
  test(`${mode}: two tabs create one SQL order with a shared intent`, async ({
    page,
    context,
  }) => {
    const writes: Write[] = [];
    await open(page, mode);
    const tab = await context.newPage();
    // Login once: both pages use the same real cookie session and local storage.
    await tab.goto("/club?checkout=1");
    await expect(pay(tab)).toBeEnabled();
    if (mode === "GUEST")
      await tab
        .getByPlaceholder("Почта для чека и входа")
        .first()
        .fill("buyer503@example.test");
    await tab
      .getByRole("textbox", { name: "Номер телефона", exact: true })
      .first()
      .fill("+79991234567");
    await loseReply(page, mode, writes);
    await loseReply(tab, mode, writes);
    await Promise.all([pay(page).click(), pay(tab).click()]);
    await pending(page);
    await pending(tab);
    await exactlyOneOrder();
    expect(writes.length).toBeGreaterThan(0);
    expect(new Set(writes.map((write) => write.orderId)).size).toBe(1);
    expect((await stored(page, mode)).idempotencyKey).toBe(
      (await stored(tab, mode)).idempotencyKey,
    );
    await tab.close();
  });
  test(`${mode}: notRecorded permits an explicit replay of the same saved request`, async ({
    page,
  }) => {
    await open(page, mode);
    await loseReply(page, mode, [], false);
    await pay(page).click();
    await pending(page);
    const first = await stored(page, mode);
    expect(await rows("SELECT orderId FROM club_payments")).toHaveLength(0);
    await page.unroute(`**/api/trpc/**${endpoint(mode)}**`);
    await page.reload();
    await expect(
      notice(page, "Создание покупки пока не подтверждено"),
    ).toBeVisible();
    const writes: Write[] = [];
    await loseReply(page, mode, writes);
    await restore(page).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].input.idempotencyKey).toBe(first.idempotencyKey);
    if (mode === "GUEST")
      expect(writes[0].input.recoveryToken).toBe(first.recoveryToken);
    await exactlyOneOrder();
  });
  test(`${mode}: changing account keeps the original proof without applying it to another user`, async ({
    page,
    context,
  }) => {
    await open(page, mode);
    const writes: Write[] = [];
    await loseReply(page, mode, writes);
    await pay(page).click();
    await pending(page);
    const before = await stored(page, mode);
    await context.clearCookies();
    await login(context, 504);
    await page.goto("/club?checkout=1");
    await expect(
      page
        .getByRole("button", { name: "Проверить покупку", exact: true })
        .first(),
    ).toBeEnabled();
    expect(await stored(page, mode)).toEqual(before);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("darcy:user:504:normal-checkout:v1"),
      ),
    ).toBeNull();
    await expect(
      page.getByText(/Оплата этой покупки подтверждена/),
    ).toHaveCount(0);
    await exactlyOneOrder();
  });
}

test("GUEST: login recovers its existing order without starting a NORMAL purchase", async ({
  page,
  context,
}) => {
  const writes: Write[] = [];
  const normalWrites: string[] = [];
  context.on("request", (request) => {
    if (request.url().includes("club.createNormalCheckout"))
      normalWrites.push(request.url());
  });
  await open(page, "GUEST");
  await loseReply(page, "GUEST", writes);
  await pay(page).click();
  await pending(page);
  const before = await stored(page, "GUEST");
  await login(context);
  await page.goto("/club?checkout=1");
  await expect(
    notice(page, "Оплата этой покупки пока не подтверждена"),
  ).toBeVisible();
  expect(await stored(page, "GUEST")).toMatchObject({
    idempotencyKey: before.idempotencyKey,
    recoveryToken: before.recoveryToken,
    ownerId: 503,
  });
  expect(normalWrites).toEqual([]);
  await exactlyOneOrder();
});

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([key, field]) => [key, ordered(field)]),
    );
  return value == null ? "" : String(value);
}
for (const mode of ["NORMAL", "GUEST"] as const) {
  test(`${mode}: subscription access alone cannot confirm the new order; a signed local receipt confirms it once`, async ({
    page,
    context,
  }) => {
    await connection.query(
      "INSERT INTO club_payments(userId,orderId,email,status,sum,paidAt,expiresAt) VALUES(503,'fixture-existing-access','buyer503@example.test','paid','790',NOW(),'2037-01-01')",
    );
    const writes: Write[] = [];
    await open(page, mode);
    await loseReply(page, mode, writes);
    await pay(page).click();
    await pending(page);
    await page.reload();
    await expect(
      notice(page, "Оплата этой покупки пока не подтверждена"),
    ).toBeVisible();
    await expect(
      page.getByText(/Оплата этой покупки подтверждена/),
    ).toHaveCount(0);
    const [payment] = await rows(
      "SELECT orderId FROM club_payments WHERE status='pending'",
    );
    const body = {
      currency: "rub",
      customer_email: "buyer503@example.test",
      domain: "fixture.payform.ru",
      order_id: "503001",
      order_num: payment.orderId,
      payment_status: "success",
      sum: "790.00",
      subscription: { id: "123", profile_id: "503" },
    };
    const bytes = JSON.stringify(ordered(body)).replace(/\//g, "\\/");
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await context.request.post(
        `${fixture.origin}/api/prodamus/webhook`,
        {
          headers: {
            Origin: fixture.origin,
            Sign: createHmac("sha256", "synthetic-checkout-merchant-key")
              .update(bytes)
              .digest("hex"),
          },
          data: body,
        },
      );
      expect(response.status()).toBe(200);
      expect(await response.text()).toBe("success");
    }
    await page.reload();
    await expect(
      notice(page, "Оплата этой покупки подтверждена"),
    ).toBeVisible();
    expect(
      await rows("SELECT paymentKey FROM billing_receipts WHERE orderId=?", [
        payment.orderId,
      ]),
    ).toHaveLength(1);
    expect(
      await rows("SELECT sentAt FROM access_email_outbox WHERE userId=503"),
    ).toMatchObject([{ sentAt: null }]);
    expect(
      await rows("SELECT orderId FROM normal_checkout_requests"),
    ).toHaveLength(1);
    expect(writes).toHaveLength(1);
  });
}
