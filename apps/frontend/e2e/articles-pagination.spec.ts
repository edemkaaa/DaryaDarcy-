import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const article = (id: number) => ({
  id,
  title: `PAGED_ARTICLE_${id}`,
  coverUrl: null,
  access: "club",
  published: false,
  sections: [{ type: "text", text: `BODY_${id}` }],
});
const titles = (page: Page) =>
  page.getByText(/^PAGED_ARTICLE_\d+$/, { exact: true });
const edit = (page: Page, id: number) =>
  page
    .getByText(`PAGED_ARTICLE_${id}`, { exact: true })
    .locator("..")
    .getByRole("button", { name: "Править", exact: true });
const list = (page: Page) => page.locator("main .ui-scroll").last();
const scrollEnd = (page: Page) =>
  list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
const body = (page: Page) =>
  page.getByPlaceholder(
    "Абзац. Пустая строка — новый абзац. Ссылка: [название](https://...)",
  );

async function open(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.fallback()
      : route.abort(),
  );
});

test("article cards load by opaque cursor and only the selected editor reads full content", async ({
  page,
}) => {
  const calls: { name: string; input: Record<string, unknown> }[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.includes("/api/trpc/")) return;
    const input = JSON.parse(
      request.postData() ?? url.searchParams.get("input") ?? "{}",
    );
    url.pathname
      .split("/api/trpc/")[1]
      .split(",")
      .forEach((name, index) =>
        calls.push({ name, input: input[index]?.json ?? {} }),
      );
  });
  const rows = Array.from({ length: 45 }, (_, i) => article(i + 1));
  let saved: Record<string, unknown> | null = null;
  await editorApi(page, (name, input) => {
    if (name === "admin.articles") return ok(rows);
    if (name === "admin.updateArticle") {
      saved = input;
      return ok({ ok: true });
    }
  });
  await open(page);
  await expect(titles(page)).toHaveCount(20);
  expect(
    calls.filter(
      (call) =>
        call.name === "admin.articles" || call.name === "admin.articleDetail",
    ),
  ).toEqual([]);
  await scrollEnd(page);
  await expect(titles(page)).toHaveCount(40);
  await edit(page, 31).click();
  await expect(body(page)).toHaveValue("BODY_31");
  await expect(
    page.getByRole("button", { name: "Статус: черновик", exact: true }),
  ).toBeVisible();
  expect(
    calls
      .filter((call) => call.name === "admin.articleDetail")
      .map((call) => call.input),
  ).toEqual([{ id: 31 }]);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect
    .poll(() => saved)
    .toMatchObject({
      id: 31,
      published: false,
      sections: [{ type: "text", text: "BODY_31" }],
    });
  await expect(titles(page)).toHaveCount(20);
  await scrollEnd(page);
  await expect(titles(page)).toHaveCount(40);
  await scrollEnd(page);
  await expect(titles(page)).toHaveCount(45);
  expect(
    calls
      .filter((call) => call.name === "admin.articlesPage")
      .map((call) => call.input.cursor ?? null),
  ).toEqual([
    null,
    "article-fixture:20",
    null,
    "article-fixture:20",
    "article-fixture:40",
  ]);
});

for (const result of [
  null,
  {},
  { ...article(1), sections: undefined },
] as const) {
  test(`invalid article detail ${JSON.stringify(result)} never opens an empty editor`, async ({
    page,
  }) => {
    let writes = 0;
    await editorApi(page, (name) => {
      if (name === "admin.articles") return ok([article(1)]);
      if (name === "admin.articleDetail") return ok(result);
      if (name === "admin.updateArticle") {
        writes++;
        return ok({ ok: true });
      }
    });
    await open(page);
    await edit(page, 1).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByPlaceholder("Что посмотреть осенью...")).toHaveCount(
      0,
    );
    expect(writes).toBe(0);
  });
}

test("a failed next article page retains cards and retries the same cursor", async ({
  page,
}) => {
  let fail = true;
  const cursors: unknown[] = [];
  await editorApi(page, (name, input) => {
    if (name === "admin.articlesPage") {
      cursors.push(input.cursor ?? null);
      if (input.cursor)
        return fail
          ? failure(400)
          : ok({ items: [article(20), article(21)], nextCursor: null });
      return ok({
        items: Array.from({ length: 20 }, (_, i) => article(i + 1)),
        nextCursor: "opaque-next",
      });
    }
  });
  await open(page);
  await expect(titles(page)).toHaveCount(20);
  await scrollEnd(page);
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить следующие статьи" });
  await expect(error).toBeVisible();
  await expect(titles(page)).toHaveCount(20);
  fail = false;
  await error.getByRole("button", { name: "Повторить" }).click();
  await expect(titles(page)).toHaveCount(21);
  expect(cursors).toEqual([null, "opaque-next", "opaque-next"]);
});

test("a late article detail is discarded after switching admin sections", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await editorApi(page, async (name) => {
    if (name === "admin.articles") return ok([article(1)]);
    if (name === "admin.articleDetail") {
      reads++;
      await held;
      return ok(article(1));
    }
  });
  try {
    await open(page);
    await edit(page, 1).click();
    await expect.poll(() => reads).toBe(1);
    await page.getByRole("button", { name: "Посты", exact: true }).click();
    release();
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    await expect(titles(page)).toHaveCount(1);
    await expect(body(page)).toHaveCount(0);
    await edit(page, 1).click();
    await expect(body(page)).toHaveValue("BODY_1");
    expect(reads).toBe(2);
  } finally {
    release();
  }
});

test("absence from the first page cannot confirm article deletion", async ({
  page,
}) => {
  let writes = 0;
  let absent = false;
  let pageReads = 0;
  await editorApi(page, (name) => {
    if (name === "admin.articlesPage") {
      pageReads++;
      return ok({
        items: writes ? [] : [article(1)],
        nextCursor: writes && !absent ? "not-proof-of-deletion" : null,
      });
    }
    if (name === "admin.articleDetail") return ok(absent ? null : article(1));
    if (name === "admin.deleteArticle") {
      writes++;
      return ok({ ok: true });
    }
  });
  page.on("dialog", (dialog) => dialog.accept());
  await open(page);
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "не подтверждён",
  );
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeDisabled();
  expect(pageReads).toBe(1);
  absent = true;
  await page
    .getByRole("button", { name: "Обновить список", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeEnabled();
  await expect(titles(page)).toHaveCount(0);
  expect(writes).toBe(1);
  expect(pageReads).toBe(2);
});

test("an article detail failure retries without creating a partial form", async ({
  page,
}) => {
  let fail = true;
  let reads = 0;
  await editorApi(page, (name) => {
    if (name === "admin.articles") return ok([article(1)]);
    if (name === "admin.articleDetail") {
      reads++;
      return fail ? failure(500) : ok(article(1));
    }
  });
  await open(page);
  await edit(page, 1).click();
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Сервис временно недоступен" });
  await expect(error).toBeVisible();
  await expect(body(page)).toHaveCount(0);
  fail = false;
  await error.getByRole("button", { name: "Повторить" }).click();
  await expect(body(page)).toHaveValue("BODY_1");
  expect(reads).toBe(2);
});

test("a checked unknown deletion that did not commit allows a deliberate retry", async ({
  page,
}) => {
  let writes = 0;
  await editorApi(page, (name) => {
    if (name === "admin.articles") return ok(writes > 1 ? [] : [article(1)]);
    if (name === "admin.deleteArticle")
      return ++writes === 1 ? failure(500) : ok({ ok: true });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await open(page);
  const remove = page.getByRole("button", { name: "Удалить", exact: true });
  await remove.click();
  await expect(remove).toBeDisabled();
  await page
    .getByRole("button", { name: "Обновить список", exact: true })
    .click();
  await expect(remove).toBeEnabled();
  await expect(titles(page)).toHaveCount(1);
  expect(writes).toBe(1);
  await remove.click();
  await expect(titles(page)).toHaveCount(0);
  expect(writes).toBe(2);
});

test("account change discards an old article detail and starts the new owner's page", async ({
  page,
}) => {
  let owner = 101;
  let oldReads = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cursors: unknown[] = [];
  await editorApi(page, async (name, input) => {
    if (name === "admin.articlesPage") {
      cursors.push(input.cursor);
      return ok({ items: [article(owner === 101 ? 1 : 2)], nextCursor: null });
    }
    if (name === "admin.articleDetail") {
      if (input.id === 1) {
        oldReads++;
        await held;
      }
      return ok(article(Number(input.id)));
    }
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
    await edit(page, 1).click();
    await expect.poll(() => oldReads).toBe(1);
    owner = 202;
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "second-owner",
        }),
      ),
    );
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    await expect(
      page.getByText("PAGED_ARTICLE_2", { exact: true }),
    ).toBeVisible();
    release();
    await expect(body(page)).toHaveCount(0);
    await edit(page, 2).click();
    await expect(body(page)).toHaveValue("BODY_2");
    expect(cursors).toEqual([null, null]);
  } finally {
    release();
  }
});
