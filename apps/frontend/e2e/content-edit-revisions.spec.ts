import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.setTimeout(45_000);
const text = (page: Page) =>
  page.getByPlaceholder("Текст поста… Enter — новый абзац");
const title = (page: Page) => page.getByPlaceholder("Что посмотреть осенью...");
const compare = (page: Page) =>
  page.getByRole("button", {
    name: "Сравнить с серверной версией",
    exact: true,
  });
const accept = (page: Page) =>
  page.getByRole("button", {
    name: "Продолжить с моими изменениями после сравнения",
    exact: true,
  });
function post() {
  return {
    id: 7,
    text: "FULL_ORIGINAL_POST",
    photos: [],
    tags: ["community"],
    target: "both",
    status: "published",
    published: true,
    richText: null,
    media: [],
    sortOrder: 17,
    scheduledAt: null,
    publishedAt: "2026-10-27T09:00:00Z",
    createdAt: "2026-10-27T09:00:00Z",
    updatedAt: "2026-10-27T09:00:00Z",
    likeCount: 0,
    commentCount: 0,
    editRevision: "post:r1",
  };
}
function article() {
  return {
    id: 9,
    title: "ORIGINAL_ARTICLE",
    coverUrl: null,
    access: "club",
    published: true,
    sections: [{ type: "text", text: "original article text" }],
    editRevision: "article:r1",
  };
}
async function fixture(page: Page) {
  const state = {
    post: post(),
    article: article(),
    writes: [] as { name: string; input: Record<string, unknown> }[],
    reject: 0,
    loseResponse: false,
    uploads: 0,
    reads: [] as string[],
  };
  page.on("dialog", (dialog) => dialog.accept());
  await editorApi(page, async (name, input, route) => {
    if (name === "admin.posts") return ok([state.post]);
    if (name === "admin.postDetail") {
      state.reads.push(name);
      return ok(state.post);
    }
    if (name === "admin.articles") return ok([state.article]);
    if (name === "admin.articleDetail") {
      state.reads.push(name);
      return ok(state.article);
    }
    if (name === "feed.listPaginated" || name === "club.listByCategory")
      return ok({
        posts: [{ ...state.post, text: "COMPACT_CARD" }],
        nextCursor: null,
      });
    if (name === "admin.updatePost" || name === "admin.updateArticle") {
      state.writes.push({ name, input });
      if (state.reject) return failure(state.reject);
      if (name === "admin.updatePost")
        state.post = {
          ...state.post,
          ...input,
          editRevision: "post:r3",
        } as typeof state.post;
      else
        state.article = {
          ...state.article,
          ...input,
          editRevision: "article:r3",
        } as typeof state.article;
      if (state.loseResponse) await route.abort("failed");
      return name === "admin.updatePost"
        ? ok({ success: true })
        : ok({ ok: true });
    }
    if (name === "admin.uploadPrivateContentFile") {
      state.uploads++;
      return ok({
        state: "ready",
        assetId: "00000000-0000-4000-8000-000000000077",
        usage: input.usage,
        filename: input.filename,
        mimeType: input.mimeType,
        fileSize: Buffer.from(String(input.base64), "base64").length,
        url: "/api/media/content-files/00000000-0000-4000-8000-000000000077",
      });
    }
    if (name === "admin.createPost") {
      state.writes.push({ name, input });
      return ok(42);
    }
  });
  return state;
}
async function fullPost(page: Page) {
  await gotoWithSession(page, "/admin");
  await page
    .getByRole("button", { name: "Редактировать пост", exact: true })
    .first()
    .click();
  await expect(text(page)).toHaveValue("FULL_ORIGINAL_POST");
  await expect(
    page.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
}
async function editArticle(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page
    .getByRole("button", { name: "Править", exact: true })
    .first()
    .click();
  await expect(title(page)).toHaveValue("ORIGINAL_ARTICLE");
}
async function readDraft(
  page: Page,
  database: string,
  store: string,
  key: string | number,
) {
  return page.evaluate(
    ({ database, store, key }) =>
      new Promise<{
        save: { editRevision?: string };
        editor: { draft: { text: string } };
        editBase: { revision?: string };
      } | null>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction(store).objectStore(store).get(key);
          read.onsuccess = () => {
            db.close();
            resolve(read.result ?? null);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
    { database, store, key },
  );
}

for (const rejection of [409, 412]) {
  test(`full post ${rejection}: original version survives reload, comparison never writes, explicit acceptance changes only the next save`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await fullPost(page);
    await text(page).fill("MY_UNSAVED_TEXT");
    state.post = {
      ...state.post,
      text: "OTHER_EDITOR",
      editRevision: "post:r2",
    };
    state.reject = rejection;
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0].input.expectedRevision).toBe("post:r1");
    await expect(compare(page)).toBeVisible();
    await expect
      .poll(
        async () =>
          (await readDraft(page, "darcy-post-drafts", "drafts", "101:full:7"))
            ?.save.editRevision,
      )
      .toBe("post:r1");
    await page.reload();
    await page
      .getByRole("button", { name: "Редактировать пост", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(text(page)).toHaveValue("MY_UNSAVED_TEXT");
    await compare(page).click();
    await expect(
      page
        .getByRole("dialog", { name: "Редактор публикации" })
        .getByText("OTHER_EDITOR", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(
      (await readDraft(page, "darcy-post-drafts", "drafts", "101:full:7"))?.save
        .editRevision,
    ).toBe("post:r1");
    await accept(page).click();
    expect(state.writes).toHaveLength(1);
    state.reject = 0;
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(text(page)).toHaveCount(0);
    expect(state.writes[1].input).toMatchObject({
      expectedRevision: "post:r2",
      text: "MY_UNSAVED_TEXT",
    });
    expect(state.writes[1].input).not.toHaveProperty("sortOrder");
    expect(
      state.reads.filter((name) => name === "admin.postDetail").length,
    ).toBeGreaterThanOrEqual(4);
  });
}

test("quick editor reads a full record and preserves its revision on a lost response", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Редактировать пост", exact: true })
    .click();
  await expect(text(page)).toHaveValue("FULL_ORIGINAL_POST");
  await expect(
    page.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
  await text(page).fill("QUICK_COMMITTED");
  state.loseResponse = true;
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(compare(page)).toBeVisible();
  expect(state.writes[0].input.expectedRevision).toBe("post:r1");
  await compare(page).click();
  await expect(
    page.getByText("Публикация №7 сохранена.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("post rejects overlong UTF-8 before any write and keeps the full input", async ({
  page,
}) => {
  const state = await fixture(page);
  await fullPost(page);
  const value = "🧶".repeat(16384);
  await text(page).fill(value);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(text(page)).toHaveValue(value);
  expect(state.writes).toEqual([]);
  await expect
    .poll(
      async () =>
        (await readDraft(page, "darcy-post-drafts", "drafts", "101:full:7"))
          ?.editor.draft.text.length,
    )
    .toBe(value.length);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`article conflict preserves the old revision across reload and requires an explicit comparison decision (${viewport.width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const state = await fixture(page);
    await editArticle(page);
    await title(page).fill("MY_ARTICLE");
    state.article = {
      ...state.article,
      title: "OTHER_ARTICLE",
      editRevision: "article:r2",
    };
    state.reject = 409;
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(compare(page)).toBeVisible();
    expect(state.writes[0].input.expectedRevision).toBe("article:r1");
    await page.reload();
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    await page
      .getByRole("button", { name: "Продолжить черновик статьи", exact: true })
      .click();
    await expect(title(page)).toHaveValue("MY_ARTICLE");
    await compare(page).click();
    await expect(page.getByText("OTHER_ARTICLE", { exact: true })).toBeVisible();
    expect(state.writes).toHaveLength(1);
    await accept(page).click();
    state.reject = 0;
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(title(page)).toHaveCount(0);
    expect(state.writes[1].input).toMatchObject({
      expectedRevision: "article:r2",
      title: "MY_ARTICLE",
    });
  });
}

test("article private file operation retains original bytes and revision through conflict and a manual rebase", async ({
  page,
}) => {
  const state = await fixture(page);
  await editArticle(page);
  await page
    .getByRole("button", { name: "Ссылка", exact: true })
    .first()
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Загрузить файл", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "revision.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("original revision bytes"),
  });
  state.article = {
    ...state.article,
    editRevision: "article:r2",
    title: "OTHER_TITLE",
  };
  state.reject = 409;
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(compare(page)).toBeVisible();
  expect(state.uploads).toBe(1);
  const stored = await readDraft(
    page,
    "darcy-article-creations",
    "operations",
    101,
  );
  expect(stored?.editBase.revision).toBe("article:r1");
  expect(state.writes[0].input.expectedRevision).toBe("article:r1");
  await compare(page).click();
  await accept(page).click();
  await page
    .getByRole("button", { name: "Продолжить черновик статьи", exact: true })
    .click();
  state.reject = 0;
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(title(page)).toHaveCount(0);
  expect(state.uploads).toBe(1);
  expect(state.writes[1].input.expectedRevision).toBe("article:r2");
});

test("tags keep a restored revision and selected input until manual conflict acceptance", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Выбрать хештеги", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Теги публикации" });
  await dialog.getByRole("button", { name: /Подборки/ }).click();
  state.post = { ...state.post, editRevision: "post:r2" };
  state.reject = 409;
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(compare(page)).toBeVisible();
  expect(state.writes[0].input.expectedRevision).toBe("post:r1");
  await compare(page).click();
  await accept(page).click();
  state.reject = 0;
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes[1].input).toMatchObject({
    expectedRevision: "post:r2",
    tags: state.writes[0].input.tags,
  });
});

test("tags with a lost response are confirmed by a read without another mutation", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Выбрать хештеги", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Теги публикации" });
  await dialog.getByRole("button", { name: /Подборки/ }).click();
  state.loseResponse = true;
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Обновить публикации", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].input.expectedRevision).toBe("post:r1");
});
