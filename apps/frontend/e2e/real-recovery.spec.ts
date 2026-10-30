import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import {
  createConnection,
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// API replies are real. Fault injection drops an ACK only after Nest/SQL completed.
// No provider, SMTP worker, production flags or existing data are used.
const file = process.env.DARYADARCY_EDITOR_FIXTURE_FILE;
test.skip(
  !file,
  "Requires pnpm test:recovery:real and its disposable database.",
);
type Fixture = { databaseUrl: string; origin: string; password: string };
let fixture: Fixture;
let connection: Connection;
let publicOrigin: string;
const adminSlot = "darcy:user:501:admin-action:v1";
const contexts: BrowserContext[] = [];
const sessions = new Map<
  number,
  Awaited<ReturnType<BrowserContext["cookies"]>>
>();
const query = async (sql: string, values: unknown[] = []) =>
  (await connection.query<RowDataPacket[]>(sql, values))[0];

test.beforeAll(async () => {
  if (!file || !basename(dirname(file)).startsWith("darcy-editor-acceptance-"))
    throw new Error("Owned fixture required");
  fixture = JSON.parse(readFileSync(file, "utf8"));
  publicOrigin = fixture.origin;
  const db = new URL(fixture.databaseUrl);
  if (
    db.protocol !== "mysql:" ||
    db.hostname !== "127.0.0.1" ||
    db.pathname !== "/backend_test" ||
    db.search ||
    db.hash ||
    new URL(fixture.origin).hostname !== "127.0.0.1"
  )
    throw new Error("Only owned loopback fixtures allowed");
  connection = await createConnection({
    uri: fixture.databaseUrl,
    timezone: "Z",
  });
});
test.beforeEach(async ({ context }) => {
  for (const table of [
    "admin_action_operations",
    "admin_audit_log",
    "access_email_outbox",
    "password_tokens",
    "billing_receipts",
    "normal_checkout_requests",
    "club_payments",
  ])
    await connection.query(`DELETE FROM ${table}`);
  await connection.query(
    "INSERT INTO club_payments(userId,orderId,email,status,sum,paidAt,expiresAt) VALUES(503,'fixture-initial','member@example.test','paid','790',NOW(),'2035-01-01')",
  );
  await connection.query(
    "UPDATE videos SET title='Original title',editRevision=0 WHERE id=18",
  );
  await prepare(context);
});
test.afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});
test.afterAll(async () => {
  await connection?.end();
});

async function prepare(context: BrowserContext) {
  // Requests remain inside the test API's configured loopback origin.
  await context.setExtraHTTPHeaders({ Origin: publicOrigin });
  await context.addInitScript(() => {
    if (!location.protocol.startsWith("http")) return;
    localStorage.setItem("@darcy_install_guide_seen", "1");
    for (const id of [501, 502])
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
  context.on("page", (page) => page.on("dialog", (dialog) => dialog.accept()));
}
async function login(context: BrowserContext, id = 501) {
  const cached = sessions.get(id);
  if (cached) {
    await context.addCookies(cached);
    return;
  }
  const result = await context.request.post(
    `${fixture.origin}/api/auth/login`,
    {
      headers: { Origin: publicOrigin },
      data: { email: `editor${id}@example.test`, password: fixture.password },
    },
  );
  expect(result.status()).toBe(200);
  sessions.set(id, await context.cookies());
}
async function other(page: Page, id = 502) {
  const context = await page
    .context()
    .browser()!
    .newContext({ baseURL: fixture.origin });
  contexts.push(context);
  await prepare(context);
  await login(context, id);
  return context.newPage();
}
const saved = (page: Page, key: string) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), key);
async function members(page: Page) {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await expect(
    page.getByText("Real recovery member", { exact: true }),
  ).toBeVisible();
}
const memberAction = (page: Page, kind: string) =>
  page
    .getByText("Real recovery member", { exact: true })
    .locator("..")
    .getByRole("button", {
      name: kind === "grantClub" ? "Продлить клуб" : "Повторить письмо",
      exact: true,
    });
const start = (page: Page, kind: string) => memberAction(page, kind).click();
const status = (page: Page) =>
  page.getByRole("button", {
    name: "Проверить результат действия",
    exact: true,
  });
const replay = (page: Page) =>
  page.getByRole("button", {
    name: "Повторить исходное действие",
    exact: true,
  });
async function effects(kind: string) {
  return query(
    kind === "grantClub"
      ? "SELECT orderId,expiresAt FROM club_payments WHERE userId=503 ORDER BY id"
      : "SELECT eventKey,sentAt FROM access_email_outbox WHERE userId=503 ORDER BY id",
  );
}

for (const kind of ["grantClub", "resendAccessEmail"]) {
  const endpoint =
    kind === "grantClub"
      ? "**/api/trpc/admin.grantClub**"
      : "**/api/admin/access-email/resend";
  test(`${kind}: lost committed ACK reloads from the real receipt without another effect`, async ({
    page,
    context,
  }) => {
    await login(context);
    await members(page);
    const writes: unknown[] = [];
    await page.route(endpoint, async (route) => {
      writes.push(route.request().postDataJSON());
      const response = await route.fetch();
      expect(response.status()).toBe(kind === "grantClub" ? 200 : 202);
      await route.abort("failed");
    });
    await start(page, kind);
    await expect(replay(page)).toBeEnabled();
    const intent = await saved(page, adminSlot);
    expect(intent).toMatchObject({ kind, userId: 503, ownerId: 501 });
    const baseline = await effects(kind);
    expect(baseline).toHaveLength(kind === "grantClub" ? 2 : 1);
    await members(page);
    await expect(
      page
        .getByText(
          kind === "grantClub"
            ? /Продление подтверждено для участницы №503/
            : /Доставка ещё не подтверждена/,
        )
        .first(),
    ).toBeVisible();
    expect(await effects(kind)).toEqual(baseline);
    expect((await saved(page, adminSlot)).idempotencyKey).toBe(
      intent.idempotencyKey,
    );
    expect(writes).toHaveLength(1);
  });
  test(`${kind}: a missing request replays the original key after reload`, async ({
    page,
    context,
  }) => {
    await login(context);
    await members(page);
    await page.route(endpoint, (route) => route.abort("failed"));
    await start(page, kind);
    await expect(replay(page)).toBeEnabled();
    const intent = await saved(page, adminSlot);
    await page.unroute(endpoint);
    await members(page);
    await expect(replay(page)).toBeEnabled();
    await replay(page).click();
    await expect(
      page
        .getByText(
          kind === "grantClub"
            ? /Продление подтверждено для участницы №503/
            : /Доставка ещё не подтверждена/,
        )
        .first(),
    ).toBeVisible();
    expect((await saved(page, adminSlot)).idempotencyKey).toBe(
      intent.idempotencyKey,
    );
    expect(await effects(kind)).toHaveLength(kind === "grantClub" ? 2 : 1);
  });
  test(`${kind}: two tabs coordinate one request and SQL effect`, async ({
    page,
    context,
  }) => {
    await login(context);
    const tab = await context.newPage();
    await members(page);
    await members(tab);
    // Observe a real committed reply, but hold its ACK while the other tab waits.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let committed!: () => void;
    const ready = new Promise<void>((resolve) => {
      committed = resolve;
    });
    await page.route(endpoint, async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(kind === "grantClub" ? 200 : 202);
      committed();
      await held;
      await route.fulfill({ response });
    });
    await start(page, kind);
    await ready;
    // The second tab's action either waits for the lock or is already disabled.
    const second = memberAction(tab, kind);
    if (await second.isEnabled()) await second.click();
    release();
    await expect(status(page)).toBeEnabled();
    await expect(status(tab)).toBeEnabled();
    expect((await saved(tab, adminSlot)).idempotencyKey).toBe(
      (await saved(page, adminSlot)).idempotencyKey,
    );
    expect(await effects(kind)).toHaveLength(kind === "grantClub" ? 2 : 1);
    await tab.close();
  });
  test(`${kind}: changing account preserves the first administrator's unresolved intent`, async ({
    page,
    context,
  }) => {
    await login(context);
    await members(page);
    await page.route(endpoint, async (route) => {
      const result = await route.fetch();
      expect(result.ok()).toBe(true);
      await route.abort("failed");
    });
    await start(page, kind);
    await expect(replay(page)).toBeEnabled();
    const intent = await saved(page, adminSlot);
    await context.clearCookies();
    await login(context, 502);
    await members(page);
    await expect(
      page.getByText(
        /Продление подтверждено для участницы №503|Результат сохранённого действия не подтверждён/,
      ),
    ).toHaveCount(0);
    expect(await saved(page, adminSlot)).toEqual(intent);
    expect(await saved(page, "darcy:user:502:admin-action:v1")).toBeNull();
  });
}

const title = (page: Page) =>
  page.getByRole("textbox", { name: "Название видео VK", exact: true });
const saveVideo = (page: Page) =>
  page.getByRole("button", { name: "Сохранить видео", exact: true });
const checkVideo = (page: Page) =>
  page.getByRole("button", {
    name: "Проверить актуальную версию",
    exact: true,
  });
async function video(page: Page, load = true) {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Видео", exact: true }).click();
  if (load) {
    await page
      .getByRole("button", { name: "Редактировать по ID", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "ID видео VK", exact: true })
      .fill("18");
    await page
      .getByRole("button", { name: "Загрузить видео", exact: true })
      .click();
  }
  await expect(title(page)).toBeVisible();
}
test("VK: real concurrent revisions preserve the losing draft through reload and manual reconciliation", async ({
  page,
  context,
}) => {
  await login(context);
  const second = await other(page);
  await video(page);
  await video(second);
  await title(page).fill("First administrator");
  await title(second).fill("Second draft");
  await saveVideo(page).click();
  await expect(
    page.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toBeVisible();
  await saveVideo(second).click();
  await expect(
    second.getByText("Актуальная версия на сервере: First administrator", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await query("SELECT title,editRevision FROM videos WHERE id=18"),
  ).toMatchObject([{ title: "First administrator", editRevision: 1 }]);
  await video(second, false);
  await expect(title(second)).toHaveValue("Second draft");
  await expect(saveVideo(second)).toBeDisabled();
  await checkVideo(second).click();
  await second
    .getByRole("button", { name: "Продолжить после сверки", exact: true })
    .click();
  await saveVideo(second).click();
  await expect(
    second.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toBeVisible();
  expect(
    await query("SELECT title,editRevision FROM videos WHERE id=18"),
  ).toMatchObject([{ title: "Second draft", editRevision: 2 }]);
});
test("VK: a lost committed ACK retains the original revision; matching SQL detail is not claimed as success", async ({
  page,
  context,
}) => {
  await login(context);
  await video(page);
  await title(page).fill("Lost VK answer");
  await page.route("**/api/trpc/admin.upsertVkVideo**", async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort("failed");
  });
  await saveVideo(page).click();
  await expect(checkVideo(page)).toBeEnabled();
  await video(page, false);
  await expect(title(page)).toHaveValue("Lost VK answer");
  await checkVideo(page).click();
  await expect(
    page.getByText("Актуальная версия на сервере: Lost VK answer", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toHaveCount(0);
  const draft = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("darcy:user:501:vk-editor:v1")!),
  );
  expect(draft.base.editRevision).toBe(0);
  expect(draft.review.editRevision).toBe(1);
});
test("VK: switching administrator does not apply a previous draft", async ({
  page,
  context,
}) => {
  await login(context);
  await video(page);
  await title(page).fill("Only administrator 501");
  await context.clearCookies();
  await login(context, 502);
  await video(page);
  await expect(title(page)).toHaveValue("Original title");
  expect(
    await query("SELECT editRevision FROM videos WHERE id=18"),
  ).toMatchObject([{ editRevision: 0 }]);
});
