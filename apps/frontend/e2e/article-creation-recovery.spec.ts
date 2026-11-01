import { expect, test, type Page } from "@playwright/test";
import { editorApi, ok, failure } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";
import type { ArticleCreationRecord } from "@/domain/content/article-creation-journal";

test.setTimeout(45_000);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const titleField = (page: Page) =>
  page.getByPlaceholder("Что посмотреть осенью...");
const storedOperation = (page: Page, owner = 101) =>
  page.evaluate(
    (ownerId) =>
      new Promise<ArticleCreationRecord | null>((resolve, reject) => {
        const request = indexedDB.open("darcy-article-creations", 1);
        request.onerror = () => reject(new Error("Cannot read operation"));
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("operations")
            .objectStore("operations")
            .get(ownerId);
          read.onsuccess = () => {
            db.close();
            resolve(read.result ?? null);
          };
          read.onerror = () => {
            db.close();
            reject(new Error("Cannot read operation"));
          };
        };
      }),
    owner,
  );
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function fixture(page: Page) {
  const state = {
    writes: [] as Record<string, unknown>[],
    statuses: [] as string[],
    statusReplies: 0,
    list: [] as {
      id: number;
      title: string;
      coverUrl: null;
      access: string;
      published: boolean;
      sections: unknown;
    }[],
    teasers: new Set<number>(),
    ledger: new Map<string, number>(),
    loseReply: true,
    commit: true,
    listError: false,
    statusOverride: undefined as unknown,
    replayError: 0,
    statusGate: undefined as Promise<void> | undefined,
    createGate: undefined as Promise<void> | undefined,
    ownerId: 101,
  };
  page.on("dialog", (dialog) => dialog.accept());
  await editorApi(page, async (name, input, route) => {
    if (name === "admin.articles")
      return state.listError ? failure(500) : ok(state.list);
    if (name === "admin.articleCreationStatus") {
      const key = String(input.idempotencyKey);
      state.statuses.push(key);
      const id = state.ledger.get(`${state.ownerId}:${key}`);
      const reply =
        state.statusOverride ??
        (id
          ? {
              status: state.list.some((item) => item.id === id)
                ? "created"
                : "deleted",
              articleId: id,
            }
          : { status: "notRecorded" });
      await state.statusGate;
      state.statusReplies++;
      return ok(reply);
    }
    if (name === "admin.createArticle") {
      expect(input.idempotencyKey).toMatch(uuid);
      const stored = await storedOperation(page, state.ownerId);
      const { idempotencyKey, ...payload } = input;
      expect(stored).toMatchObject({
        ownerId: state.ownerId,
        idempotencyKey,
        payload,
      });
      state.writes.push(input);
      if (state.replayError) return failure(state.replayError);
      const actorKey = `${state.ownerId}:${idempotencyKey}`;
      let id = state.ledger.get(actorKey);
      if (!id && state.commit) {
        id = 42 + state.ledger.size;
        state.ledger.set(actorKey, id);
        state.list.push({
          id,
          title: String(input.title),
          coverUrl: null,
          access: String(input.access),
          published: Boolean(input.published),
          sections: input.sections,
        });
        if (input.published) state.teasers.add(id);
      }
      await state.createGate;
      if (state.loseReply) {
        await route.abort("failed");
        return ok(id);
      }
      return ok(id);
    }
  });
  return state;
}
async function openArticles(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
}
async function loseCreation(page: Page, title = "RECOVERY_ARTICLE") {
  await openArticles(page);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await titleField(page).fill(title);
  await page.getByRole("button", { name: "Фото", exact: true }).first().click();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Результат сохранения не подтверждён" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Проверить сохранение", exact: true }),
  ).toBeEnabled();
}
async function restore(page: Page) {
  await page
    .getByRole("button", { name: "Восстановить создание статьи", exact: true })
    .click();
  await expect(titleField(page)).toHaveValue("RECOVERY_ARTICLE");
}

test("lost committed response and reload recover one article and teaser without another POST", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCreation(page);
  const original = await storedOperation(page);
  if (!original) throw new Error("Creation was not persisted before POST");
  expect(original.payload.sections).toContainEqual({
    type: "photo",
    url: "",
    caption: "",
  });
  await page.reload();
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await restore(page);
  expect(await storedOperation(page)).toEqual(original);
  await page
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
  await expect(titleField(page)).toHaveCount(0);
  await expect(page.getByText("RECOVERY_ARTICLE", { exact: true })).toHaveCount(
    1,
  );
  expect(state.writes).toHaveLength(1);
  expect(state.statuses).toEqual([original.idempotencyKey]);
  expect(state.teasers.size).toBe(1);
  expect(await storedOperation(page)).toBeNull();
});

test("notRecorded keeps the original operation and only an explicit replay sends the exact payload", async ({
  page,
}) => {
  const state = await fixture(page);
  state.commit = false;
  await loseCreation(page);
  const original = await storedOperation(page);
  await page
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Первый запрос ещё может завершиться" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(await storedOperation(page)).toEqual(original);
  state.commit = true;
  state.loseReply = false;
  await page
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await expect(titleField(page)).toHaveCount(0);
  expect(state.writes).toEqual([state.writes[0], state.writes[0]]);
  expect(state.list).toHaveLength(1);
  expect(state.teasers.size).toBe(1);
});

test("notRecorded can precede a late commit; replay still uses the original key", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCreation(page);
  state.statusOverride = { status: "notRecorded" };
  state.loseReply = false;
  await page
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await expect(titleField(page)).toHaveCount(0);
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.list).toHaveLength(1);
  expect(state.teasers.size).toBe(1);
});

test("deleted result never automatically creates a replacement", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCreation(page);
  state.list = [];
  state.teasers.clear();
  await page
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await expect(titleField(page)).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.list).toHaveLength(0);
  expect(await storedOperation(page)).toBeNull();
});

test("CONFLICT retains the key and immutable payload instead of starting another operation", async ({
  page,
}) => {
  const state = await fixture(page);
  state.commit = false;
  await loseCreation(page);
  const original = await storedOperation(page);
  state.replayError = 409;
  await page
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "конфликт данных" }),
  ).toBeVisible();
  expect(await storedOperation(page)).toEqual(original);
  expect(state.writes[1]).toEqual(state.writes[0]);
  await expect(
    page.getByRole("button", { name: "Опубликовать", exact: true }),
  ).toBeDisabled();
});

test("cancellation requires a fresh real list and retains the pending operation on a read failure", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCreation(page);
  state.listError = true;
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Отмена не подтверждена" }),
  ).toBeVisible();
  await expect(titleField(page)).toHaveValue("RECOVERY_ARTICLE");
  state.listError = false;
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(titleField(page)).toHaveCount(0);
  await expect(page.getByText("RECOVERY_ARTICLE", { exact: true })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("button", {
      name: "Восстановить создание статьи",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("a late status reply cannot reset a different form after navigation", async ({
  page,
}) => {
  const state = await fixture(page);
  state.list.push({
    id: 7,
    title: "EXISTING_ARTICLE",
    coverUrl: null,
    access: "club",
    published: false,
    sections: [{ type: "text", text: "Original" }],
  });
  await loseCreation(page);
  const gate = deferred();
  state.statusGate = gate.promise;
  await page
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
  await expect.poll(() => state.statuses.length).toBe(1);
  await page.getByRole("button", { name: "Посты", exact: true }).click();
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page.getByRole("button", { name: "Править", exact: true }).click();
  await titleField(page).fill("DIFFERENT_FORM");
  gate.resolve();
  await expect.poll(() => state.statusReplies).toBe(1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(titleField(page)).toHaveValue("DIFFERENT_FORM");
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(await storedOperation(page)).not.toBeNull();
});

test("a late status reply cannot enter the new account's form or clear its operation", async ({
  page,
}) => {
  const state = await fixture(page);
  await loseCreation(page);
  const gate = deferred();
  state.statusGate = gate.promise;
  await page
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
  await expect.poll(() => state.statuses.length).toBe(1);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 102,
          openId: "other-admin",
          role: "admin",
          name: "Other",
          email: "other@example.test",
          lastSignedIn: "2026-10-04T10:00:00Z",
        },
      },
    }),
  );
  state.ownerId = 102;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(titleField(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await expect(titleField(page)).toHaveValue("");
  await titleField(page).fill("OTHER_ACCOUNT_DRAFT");
  gate.resolve();
  await expect.poll(() => state.statusReplies).toBe(1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(titleField(page)).toHaveValue("OTHER_ACCOUNT_DRAFT");
  expect(state.statuses).toHaveLength(1);
  expect(await storedOperation(page, 102)).toBeNull();
});

test("another tab cannot overwrite the outstanding operation with a new payload", async ({
  page,
  context,
}) => {
  const state = await fixture(page);
  await openArticles(page);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await titleField(page).fill("SECOND_TAB_PAYLOAD");
  const other = await context.newPage();
  await fixture(other);
  await openArticles(other);
  await other
    .getByRole("button", { name: "Продолжить черновик статьи", exact: true })
    .click();
  await titleField(other).fill("RECOVERY_ARTICLE");
  await other
    .getByRole("button", { name: "Опубликовать", exact: true })
    .click();
  await expect(
    other.getByRole("button", { name: "Проверить сохранение", exact: true }),
  ).toBeEnabled();
  const original = await storedOperation(other);
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(titleField(page)).toHaveValue("RECOVERY_ARTICLE");
  expect(state.writes).toHaveLength(0);
  expect(await storedOperation(page)).toEqual(original);
});

test("storage failure prevents creation before any POST", async ({ page }) => {
  const state = await fixture(page);
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", { value: undefined }),
  );
  await openArticles(page);
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "операцию статьи" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

test("a real client timeout retains the persisted operation without automatically repeating the POST", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.createGate = gate.promise;
  state.loseReply = false;
  await openArticles(page);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await titleField(page).fill("TIMED_OUT_ARTICLE");
  await page.clock.install();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  const original = await storedOperation(page);
  await page.clock.fastForward(15_000);
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Результат сохранения не подтверждён" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(await storedOperation(page)).toEqual(original);
  gate.resolve();
  state.createGate = undefined;
  await page
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
  await expect(titleField(page)).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.teasers.size).toBe(1);
});
