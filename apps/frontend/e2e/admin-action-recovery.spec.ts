import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const storageKey = "darcy:user:101:admin-action:v1";
const expiry = "2041-12-01T00:00:00.000Z";
const member = {
  id: 201,
  name: "Восстановление клуба",
  email: "member@example.test",
  contactPhone: null,
  role: "user",
  createdAt: "2026-10-01T00:00:00Z",
  clubExpiresAt: "2040-01-01T00:00:00Z",
  blockedAt: null,
  blockedReason: null,
};
type Kind = "grantClub" | "resendAccessEmail";
type Request = { idempotencyKey: string; userId: number };
async function setup(page: Page, kind: Kind) {
  const state = {
    writes: [] as Request[],
    effects: 0,
    lose: true,
    commit: true,
    badStatus: false,
    statusError: false,
    reads: 0,
    rateLimit: false,
    reject: false,
  };
  const receipts = new Map<string, unknown>();
  await editorApi(page, async (name, input, route) => {
    if (name === "admin.members")
      return ok([
        {
          ...member,
          clubExpiresAt:
            state.effects && kind === "grantClub"
              ? expiry
              : member.clubExpiresAt,
        },
      ]);
    if (name === "admin.actionStatus") {
      state.reads++;
      if (state.statusError) return failure(503);
      if (state.badStatus)
        return ok({
          state: "succeeded",
          kind: "resendAccessEmail",
          userId: 999,
          queued: true,
        });
      return ok(
        receipts.get(String(input.idempotencyKey)) ?? { state: "notFound" },
      );
    }
    if (name === "admin.grantClub") {
      const request = input as Request;
      await accept(request);
      if (state.lose) await route.abort("failed");
      return ok({ ok: true, expiresAt: expiry });
    }
  });
  async function accept(request: Request) {
    state.writes.push(request);
    expect(request).toEqual({
      userId: 201,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    );
    expect(saved).toMatchObject({
      ...request,
      ownerId: 101,
      kind,
      attempted: true,
    });
    if (state.commit && !receipts.has(request.idempotencyKey)) {
      state.effects++;
      receipts.set(
        request.idempotencyKey,
        state.reject
          ? { state: "rejected", kind, userId: 201, code: "CONFLICT" }
          : kind === "grantClub"
            ? { state: "succeeded", kind, userId: 201, expiresAt: expiry }
            : { state: "succeeded", kind, userId: 201, queued: true },
      );
    }
  }
  await page.route("**/api/admin/access-email/resend", async (route) => {
    await accept(route.request().postDataJSON());
    if (state.rateLimit)
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "2" },
        json: { error: "PRIVATE_SMTP" },
      });
    if (state.lose) return route.abort("failed");
    await route.fulfill({ status: 202, json: { queued: true } });
  });
  return state;
}
async function open(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await expect(page.getByText(member.name, { exact: true })).toBeVisible();
}
async function start(page: Page, kind: Kind) {
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: kind === "grantClub" ? "Продлить клуб" : "Повторить письмо",
      exact: true,
    })
    .click();
}
async function replay(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Повторить исходное действие", exact: true })
    .click();
}
const confirmed = (page: Page, kind: Kind) =>
  kind === "grantClub"
    ? page.getByText(/Продление подтверждено.*01.12.2041/)
    : page
        .getByText(
          "Письмо с доступом поставлено в очередь. Доставка ещё не подтверждена.",
        )
        .first();

for (const kind of ["grantClub", "resendAccessEmail"] as const) {
  test(`${kind}: lost committed ACK is restored after reload with status only`, async ({
    page,
  }) => {
    const state = await setup(page, kind);
    await open(page);
    await start(page, kind);
    await expect(
      page.getByRole("button", {
        name: "Повторить исходное действие",
        exact: true,
      }),
    ).toBeEnabled();
    expect(state.effects).toBe(1);
    await page.reload();
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    await expect(confirmed(page, kind)).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.reads).toBeGreaterThan(0);
    expect(state.effects).toBe(1);
  });
  test(`${kind}: notFound permits only explicit replay of the same intent`, async ({
    page,
  }) => {
    const state = await setup(page, kind);
    state.commit = false;
    await open(page);
    await start(page, kind);
    await expect(
      page.getByRole("button", {
        name: "Повторить исходное действие",
        exact: true,
      }),
    ).toBeEnabled();
    const key = state.writes[0].idempotencyKey;
    await page
      .getByRole("button", {
        name: "Проверить результат действия",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Повторить исходное действие",
        exact: true,
      }),
    ).toBeEnabled();
    expect(state.writes).toHaveLength(1);
    state.commit = true;
    state.lose = false;
    await replay(page);
    await expect(confirmed(page, kind)).toBeVisible();
    expect(state.writes).toEqual([
      { userId: 201, idempotencyKey: key },
      { userId: 201, idempotencyKey: key },
    ]);
    expect(state.effects).toBe(1);
  });
  test(`${kind}: a second tab recovers without adding an effect; a new action is explicit`, async ({
    page,
    context,
  }) => {
    const state = await setup(page, kind);
    state.lose = false;
    await open(page);
    await start(page, kind);
    await expect(confirmed(page, kind)).toBeVisible();
    const other = await context.newPage();
    // Same fixture ledger in this test's first tab: second tab only reads it.
    await editorApi(other, (name, input) => {
      if (name === "admin.members") return ok([member]);
      if (name === "admin.actionStatus") {
        if (
          !state.writes.some(
            (write) => write.idempotencyKey === input.idempotencyKey,
          )
        )
          return ok({ state: "notFound" });
        return ok(
          kind === "grantClub"
            ? { state: "succeeded", kind, userId: 201, expiresAt: expiry }
            : { state: "succeeded", kind, userId: 201, queued: true },
        );
      }
      if (name === "admin.grantClub")
        throw Error("unexpected second-tab write");
    });
    const extraWrites: string[] = [];
    other.on("request", (request) => {
      if (request.url().endsWith("/api/admin/access-email/resend"))
        extraWrites.push(request.url());
    });
    await open(other);
    await expect(confirmed(other, kind)).toBeVisible();
    expect(extraWrites).toEqual([]);
    expect(state.effects).toBe(1);
    // A fresh click plus confirmation is a deliberately new operation.
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", {
        name:
          kind === "grantClub" ? "Продлить клуб" : "Отправить ещё одно письмо",
        exact: true,
      })
      .click();
    await expect.poll(() => state.writes.length).toBe(2);
    expect(state.writes[1].idempotencyKey).not.toBe(
      state.writes[0].idempotencyKey,
    );
    await other.close();
  });
}

test("two simultaneously ready tabs cannot create separate intents", async ({
  page,
  context,
}) => {
  const first = await setup(page, "grantClub");
  first.commit = false;
  const other = await context.newPage();
  const second = await setup(other, "grantClub");
  second.commit = false;
  await open(page);
  await open(other);
  await Promise.all([start(page, "grantClub"), start(other, "grantClub")]);
  await expect(
    page.getByRole("button", {
      name: "Повторить исходное действие",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    other.getByRole("button", {
      name: "Повторить исходное действие",
      exact: true,
    }),
  ).toBeEnabled();
  expect(first.writes.length + second.writes.length).toBe(1);
  const keys = await Promise.all(
    [page, other].map((tab) =>
      tab.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).idempotencyKey,
        storageKey,
      ),
    ),
  );
  expect(keys[0]).toBe(keys[1]);
  await other.close();
});

for (const fault of ["storage", "mismatch", "status503", "rejected"] as const) {
  test(`saved admin action handles ${fault} without replacing its key`, async ({
    page,
  }) => {
    const state = await setup(page, "grantClub");
    if (fault === "storage")
      await page.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key.includes(":admin-action:")) throw Error("quota");
          return original.call(this, key, value);
        };
      });
    state.reject = fault === "rejected";
    await open(page);
    await start(page, "grantClub");
    if (fault === "storage") {
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "сохранить",
      );
      expect(state.writes).toHaveLength(0);
      return;
    }
    await expect(
      page.getByRole("button", {
        name: "Повторить исходное действие",
        exact: true,
      }),
    ).toBeEnabled();
    state.badStatus = fault === "mismatch";
    state.statusError = fault === "status503";
    await page
      .getByRole("button", {
        name: "Проверить результат действия",
        exact: true,
      })
      .click();
    if (fault === "rejected")
      await expect(page.getByText(/Сервер подтвердил отказ/)).toBeVisible();
    else {
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        fault === "mismatch" ? "Некорректный ответ" : "временно недоступен",
      );
      await expect(
        page.getByRole("button", { name: "Продлить клуб", exact: true }),
      ).toBeDisabled();
    }
    expect(state.writes).toHaveLength(1);
  });
}

test("429 persists a cooldown through reload and status remains available", async ({
  page,
}) => {
  await page.clock.install();
  const state = await setup(page, "resendAccessEmail");
  state.rateLimit = true;
  state.commit = false;
  state.lose = false;
  await open(page);
  await start(page, "resendAccessEmail");
  const retry = page.getByRole("button", {
    name: "Повторить исходное действие",
    exact: true,
  });
  await expect(retry).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await expect(retry).toBeDisabled();
  const check = page.getByRole("button", {
    name: "Проверить результат действия",
    exact: true,
  });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(check).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  await page.clock.fastForward(2100);
  state.rateLimit = false;
  state.commit = true;
  await replay(page);
  await expect(confirmed(page, "resendAccessEmail")).toBeVisible();
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.effects).toBe(1);
});

test("recovery actions and members remain reachable at 320x400", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 400 });
  await setup(page, "grantClub");
  await open(page);
  await start(page, "grantClub");
  const check = page.getByRole("button", {
    name: "Проверить результат действия",
    exact: true,
  });
  await check.scrollIntoViewIfNeeded();
  const box = await check.boundingBox();
  const nav = await page
    .getByRole("navigation", { name: "Разделы", exact: true })
    .boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
  await check.click();
  await expect(check).toBeEnabled();
  const person = page.getByText(member.name, { exact: true });
  await person.scrollIntoViewIfNeeded();
  const personBox = await person.boundingBox();
  expect(personBox!.y + personBox!.height).toBeLessThanOrEqual(nav!.y);
  await page.screenshot({
    path: test.info().outputPath("admin-recovery-320x400.png"),
  });
});
