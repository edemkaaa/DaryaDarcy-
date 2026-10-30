import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import {
  createConnection,
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

// This suite never fabricates API responses. Faults forward to the real API
// before dropping an ACK, or remove a revision to exercise the real 412 path.
const file = process.env.DARYADARCY_EDITOR_FIXTURE_FILE;
test.skip(
  !file,
  "Requires pnpm test:editors:real and its disposable Docker database.",
);
type Fixture = { databaseUrl: string; origin: string; password: string };
let fixture: Fixture;
let connection: Connection;
const extraContexts: BrowserContext[] = [];
const sessions = new Map<
  number,
  Awaited<ReturnType<BrowserContext["cookies"]>>
>();
const original = "REAL_ORIGINAL_POST";
const articleOriginal = "REAL_ORIGINAL_ARTICLE";
type Mode = "full" | "quick";
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
const save = (page: Page) =>
  page.getByRole("button", { name: "Сохранить", exact: true }).first();
async function rows(sql: string, values: unknown[] = []) {
  return (await connection.query<RowDataPacket[]>(sql, values))[0];
}
test.beforeAll(async () => {
  if (!file || !basename(dirname(file)).startsWith("darcy-editor-acceptance-"))
    throw new Error("Owned fixture required");
  fixture = JSON.parse(readFileSync(file, "utf8")) as Fixture;
  const db = new URL(fixture.databaseUrl);
  if (
    db.protocol !== "mysql:" ||
    db.hostname !== "127.0.0.1" ||
    db.pathname !== "/backend_test" ||
    db.search ||
    db.hash
  )
    throw new Error("Only disposable local backend_test is allowed");
  if (new URL(fixture.origin).hostname !== "127.0.0.1")
    throw new Error("Loopback web required");
  connection = await createConnection({
    uri: fixture.databaseUrl,
    timezone: "Z",
  });
});
test.beforeEach(async ({ context }) => {
  for (const table of [
    "post_media",
    "posts",
    "articles",
    "private_attachment_uploads",
    "private_content_files",
    "post_creation_requests",
    "article_creation_requests",
  ]) {
    await connection.query(`DELETE FROM ${table}`);
  }
  await connection.query(
    "INSERT INTO posts(id,text,photos,tags,target,status,published,publishedAt) VALUES(71,?,JSON_ARRAY(),JSON_ARRAY('community'),'both','published',TRUE,NOW())",
    [original],
  );
  await connection.query(
    "INSERT INTO articles(id,title,access,published,sections) VALUES(81,?,'club',TRUE,?)",
    [
      articleOriginal,
      JSON.stringify([{ type: "text", text: "REAL_ORIGINAL_BODY" }]),
    ],
  );
  await prepare(context);
  await login(context);
});
test.afterEach(async () => {
  for (const context of extraContexts.splice(0)) await context.close();
});
test.afterAll(async () => {
  await connection?.end();
});
async function prepare(context: BrowserContext) {
  await context.addInitScript(() => {
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    localStorage.setItem("@darcy_install_guide_seen", "1");
    for (const id of [501, 502])
      localStorage.setItem(
        `darcy:user:${id}:@darcy_club_profile_completed`,
        "true",
      );
  });
  await context.route("**/*", (route) => {
    return new URL(route.request().url()).origin === fixture.origin
      ? route.continue()
      : route.abort();
  });
  context.on("page", (page) => page.on("dialog", (dialog) => dialog.accept()));
}
async function login(context: BrowserContext, id = 501) {
  const cached = sessions.get(id);
  if (cached) {
    await context.addCookies(cached);
    return;
  }
  const response = await context.request.post(
    `${fixture.origin}/api/auth/login`,
    {
      headers: { Origin: fixture.origin },
      data: { email: `editor${id}@example.test`, password: fixture.password },
    },
  );
  expect(response.status()).toBe(200);
  expect(
    (await context.cookies()).find((c) => c.name === "app_session_id")
      ?.httpOnly,
  ).toBe(true);
  sessions.set(id, await context.cookies());
}
async function logout(context: BrowserContext) {
  expect(
    (
      await context.request.post(`${fixture.origin}/api/auth/logout`, {
        headers: { Origin: fixture.origin },
      })
    ).status(),
  ).toBe(200);
  sessions.delete(501);
}
async function otherPage(page: Page, id = 502) {
  const context = await page
    .context()
    .browser()!
    .newContext({ baseURL: fixture.origin });
  extraContexts.push(context);
  await prepare(context);
  await login(context, id);
  return context.newPage();
}
async function openPost(page: Page, mode: Mode, create = false) {
  await page.goto(mode === "full" ? "/admin" : "/feed");
  if (mode === "quick" && !create)
    await page
      .getByRole("button", { name: "Действия с постом", exact: true })
      .first()
      .click();
  await page
    .getByRole("button", {
      name: create ? "Новый пост" : "Редактировать пост",
      exact: true,
    })
    .first()
    .click();
  await expect(text(page)).toBeVisible();
  const restore = page.getByRole("button", {
    name: "Восстановить черновик",
    exact: true,
  });
  const checkpoint = page.getByText("Черновик сохранён на этом устройстве", {
    exact: true,
  });
  await expect
    .poll(
      async () => (await restore.isVisible()) || (await checkpoint.isVisible()),
    )
    .toBe(true);
  if (await restore.isVisible()) await restore.click();
  // A recovered unresolved mutation is intentionally blocked, rather than idle.
  await expect
    .poll(
      async () =>
        (await checkpoint.isVisible()) || (await compare(page).isVisible()),
    )
    .toBe(true);
}
async function openArticle(page: Page, restore = false) {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page
    .getByRole("button", {
      name: restore
        ? /^(Продолжить черновик статьи|Восстановить изменение статьи)$/
        : "Править",
      exact: true,
    })
    .first()
    .click();
  await expect(title(page)).toBeVisible();
}
function writes(page: Page, procedure: string) {
  const inputs: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const names = new URL(request.url()).pathname
      .split("/api/trpc/")[1]
      ?.split(",");
    const index = names?.indexOf(procedure) ?? -1;
    if (index < 0) return;
    const body = request.postDataJSON();
    inputs.push(body[index]?.json ?? body.json);
  });
  return inputs;
}
async function rejectMissingRevision(route: Route) {
  const body = route.request().postDataJSON();
  const input = body[0]?.json ?? body.json;
  expect(input.expectedRevision).toMatch(/^[a-f0-9]{64}$/);
  delete input.expectedRevision;
  await route.continue({ postData: JSON.stringify(body) });
}
async function loseNextAck(page: Page, procedure: string) {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const done = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  await page.route(
    `**/api/trpc/${procedure}**`,
    async (route) => {
      try {
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
        resolve();
      } catch (error) {
        reject(error);
      }
    },
    { times: 1 },
  );
  return { done };
}
async function storedOperation(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        editConflict?: number;
        media?: { phase: string };
        payload: { title: string };
      } | null>((resolve, reject) => {
        const open = indexedDB.open("darcy-article-creations", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("operations")) {
            db.close();
            resolve(null);
            return;
          }
          const request = db
            .transaction("operations")
            .objectStore("operations")
            .get(501);
          request.onsuccess = () => {
            db.close();
            resolve(request.result ?? null);
          };
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
        };
      }),
  );
}
for (const mode of ["full", "quick"] as const) {
  test(`${mode}: two real admins conflict; reload preserves text; only reviewed save replaces it`, async ({
    page,
  }) => {
    const sent = writes(page, "admin.updatePost");
    await openPost(page, mode);
    await text(page).fill("MY_UNSAVED_TEXT");
    const other = await otherPage(page);
    await openPost(other, mode);
    await text(other).fill("OTHER_EDITOR");
    await save(other).click();
    await expect(text(other)).toHaveCount(0);
    const conflict = page.waitForResponse(
      (r) => r.url().includes("admin.updatePost") && r.status() === 409,
    );
    await save(page).click();
    await conflict;
    await expect(compare(page)).toBeVisible();
    expect((await rows("SELECT text FROM posts WHERE id=71"))[0].text).toBe(
      "OTHER_EDITOR",
    );
    await page.reload();
    await openPost(page, mode);
    await expect(text(page)).toHaveValue("MY_UNSAVED_TEXT");
    await compare(page).click();
    await expect(
      page
        .getByRole("dialog", { name: "Редактор публикации" })
        .getByText("OTHER_EDITOR", { exact: true }),
    ).toBeVisible();
    expect(sent).toHaveLength(1);
    await accept(page).click();
    expect(sent).toHaveLength(1);
    await save(page).click();
    await expect(text(page)).toHaveCount(0);
    expect(sent).toHaveLength(2);
    expect(sent[1].expectedRevision).not.toBe(sent[0].expectedRevision);
    expect((await rows("SELECT text FROM posts WHERE id=71"))[0].text).toBe(
      "MY_UNSAVED_TEXT",
    );
  });
  test(`${mode}: actual server 412 keeps input and never retries automatically`, async ({
    page,
  }) => {
    const sent = writes(page, "admin.updatePost");
    await openPost(page, mode);
    await text(page).fill("KEEP_AFTER_412");
    await page.route("**/api/trpc/admin.updatePost**", rejectMissingRevision);
    const rejected = page.waitForResponse(
      (r) => r.url().includes("admin.updatePost") && r.status() === 412,
    );
    await save(page).click();
    await rejected;
    await expect(compare(page)).toBeVisible();
    await expect(text(page)).toHaveValue("KEEP_AFTER_412");
    expect((await rows("SELECT text FROM posts WHERE id=71"))[0].text).toBe(
      original,
    );
    expect(sent).toHaveLength(1);
    await page.unroute("**/api/trpc/admin.updatePost**", rejectMissingRevision);
    await page.reload();
    await openPost(page, mode);
    await expect(text(page)).toHaveValue("KEEP_AFTER_412");
    await compare(page).click();
    await expect(accept(page)).toBeVisible();
    expect(sent).toHaveLength(1);
    await accept(page).click();
    await save(page).click();
    await expect(text(page)).toHaveCount(0);
    expect((await rows("SELECT text FROM posts WHERE id=71"))[0].text).toBe(
      "KEEP_AFTER_412",
    );
  });
  test(`${mode}: a committed SQL write with a lost ACK is confirmed after reload without another mutation`, async ({
    page,
  }) => {
    const sent = writes(page, "admin.updatePost");
    await openPost(page, mode);
    await text(page).fill("COMMITTED_WITHOUT_ACK");
    const lost = await loseNextAck(page, "admin.updatePost");
    await save(page).click();
    await lost.done;
    await expect(compare(page)).toBeVisible();
    expect((await rows("SELECT text FROM posts WHERE id=71"))[0].text).toBe(
      "COMMITTED_WITHOUT_ACK",
    );
    await page.reload();
    await openPost(page, mode);
    await expect(text(page)).toHaveValue("COMMITTED_WITHOUT_ACK");
    await compare(page).click();
    await expect(
      page.getByText("Публикация №71 сохранена.", { exact: true }),
    ).toBeVisible();
    expect(sent).toHaveLength(1);
  });
  test(`${mode}: file bytes and text survive reload and save through the real upload API`, async ({
    page,
    context,
  }) => {
    await openPost(page, mode);
    await text(page).fill("POST_WITH_REAL_FILE");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Документ", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "acceptance.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("real post attachment bytes"),
    });
    await expect(
      page.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await openPost(page, mode);
    await expect(text(page)).toHaveValue("POST_WITH_REAL_FILE");
    await expect(
      page.getByText("acceptance.txt", { exact: true }),
    ).toBeVisible();
    await save(page).click();
    await expect(text(page)).toHaveCount(0);
    const media = await rows("SELECT url FROM post_media WHERE postId=71");
    expect(media).toHaveLength(1);
    const response = await context.request.get(fixture.origin + media[0].url);
    expect(response.status()).toBe(200);
    expect((await response.body()).toString()).toBe(
      "real post attachment bytes",
    );
  });
  test(`${mode}: account switch does not expose the original owner's draft`, async ({
    page,
    context,
  }) => {
    await openPost(page, mode);
    await text(page).fill("OWNER_501_PRIVATE_INPUT");
    await expect(
      page.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await logout(context);
    await login(context, 502);
    await openPost(page, mode);
    await expect(text(page)).toHaveValue(original);
    await expect(
      page.getByRole("button", { name: "Восстановить черновик", exact: true }),
    ).toHaveCount(0);
    expect((await rows("SELECT text FROM posts WHERE id=71"))[0].text).toBe(
      original,
    );
  });
  test(`${mode}: a second tab's newer draft blocks stale writes before the API`, async ({
    page,
    context,
  }) => {
    const sent = writes(page, "admin.createPost");
    await openPost(page, mode, true);
    await text(page).fill("FIRST_TAB_INPUT");
    await expect(
      page.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    const second = await context.newPage();
    await openPost(second, mode, true);
    await expect(text(second)).toHaveValue("FIRST_TAB_INPUT");
    await text(second).fill("NEWER_SECOND_TAB_INPUT");
    await expect(
      second.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await text(page).fill("STALE_FIRST_TAB_INPUT");
    await expect(
      page
        .getByRole("dialog", { name: "Редактор публикации" })
        .getByRole("alert"),
    ).toContainText("другой вкладке");
    await expect(
      page
        .getByRole("button", {
          name: mode === "full" ? "Сохранить" : "Опубликовать",
          exact: true,
        })
        .first(),
    ).toBeDisabled();
    expect(sent).toHaveLength(0);
    expect((await rows("SELECT COUNT(*) AS n FROM posts"))[0].n).toBe(1);
  });
}

test("article: real 409, reload and file recovery preserve bytes and reuse the uploaded asset", async ({
  page,
  context,
}) => {
  const sent = writes(page, "admin.updateArticle");
  const uploads = writes(page, "admin.uploadPrivateContentFile");
  await openArticle(page);
  await title(page).fill("MY_ARTICLE_WITH_FILE");
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
    name: "article.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("real article attachment bytes"),
  });
  const other = await otherPage(page);
  await openArticle(other);
  await title(other).fill("OTHER_ARTICLE");
  await save(other).click();
  await expect(title(other)).toHaveCount(0);
  const conflict = page.waitForResponse(
    (r) => r.url().includes("admin.updateArticle") && r.status() === 409,
  );
  await save(page).click();
  await conflict;
  await expect(compare(page)).toBeVisible();
  expect(uploads).toHaveLength(1);
  await expect
    .poll(async () => (await storedOperation(page))?.editConflict)
    .toBe(409);
  await page.reload();
  expect((await storedOperation(page))?.payload.title).toBe(
    "MY_ARTICLE_WITH_FILE",
  );
  await openArticle(page, true);
  await expect(title(page)).toHaveValue("MY_ARTICLE_WITH_FILE");
  await compare(page).click();
  await expect(page.getByText("OTHER_ARTICLE", { exact: true })).toBeVisible();
  expect(sent).toHaveLength(1);
  await accept(page).click();
  await page
    .getByRole("button", { name: "Продолжить черновик статьи", exact: true })
    .click();
  await save(page).click();
  await expect(title(page)).toHaveCount(0);
  expect(sent).toHaveLength(2);
  expect(uploads).toHaveLength(1);
  const article = (
    await rows("SELECT title,sections FROM articles WHERE id=81")
  )[0];
  expect(article.title).toBe("MY_ARTICLE_WITH_FILE");
  const encoded = JSON.stringify(article.sections);
  const url = encoded.match(/\/api\/media\/content-files\/[a-f0-9-]{36}/)?.[0];
  expect(url).toBeTruthy();
  const response = await context.request.get(fixture.origin + url);
  expect(response.status()).toBe(200);
  expect((await response.body()).toString()).toBe(
    "real article attachment bytes",
  );
  expect(
    (await rows("SELECT COUNT(*) AS n FROM private_content_files"))[0].n,
  ).toBe(1);
});

test("article: a committed write with a lost ACK is confirmed without another mutation", async ({
  page,
}) => {
  const sent = writes(page, "admin.updateArticle");
  await openArticle(page);
  await title(page).fill("COMMITTED_ARTICLE_WITHOUT_ACK");
  const lost = await loseNextAck(page, "admin.updateArticle");
  await save(page).click();
  await lost.done;
  await expect(compare(page)).toBeVisible();
  await page.reload();
  await openArticle(page, true);
  await expect(title(page)).toHaveValue("COMMITTED_ARTICLE_WITHOUT_ACK");
  await compare(page).click();
  await expect(title(page)).toHaveCount(0);
  expect(sent).toHaveLength(1);
  expect((await rows("SELECT title FROM articles WHERE id=81"))[0].title).toBe(
    "COMMITTED_ARTICLE_WITHOUT_ACK",
  );
});

test("article: actual 412 and account switch preserve ownership of unsaved input", async ({
  page,
  context,
}) => {
  await openArticle(page);
  await title(page).fill("OWNER_501_PRIVATE_ARTICLE");
  await page.route("**/api/trpc/admin.updateArticle**", rejectMissingRevision);
  const rejected = page.waitForResponse(
    (r) => r.url().includes("admin.updateArticle") && r.status() === 412,
  );
  await save(page).click();
  await rejected;
  await expect(compare(page)).toBeVisible();
  expect((await rows("SELECT title FROM articles WHERE id=81"))[0].title).toBe(
    articleOriginal,
  );
  await logout(context);
  await login(context, 502);
  await openArticle(page);
  await expect(title(page)).toHaveValue(articleOriginal);
  await expect(
    page.getByRole("button", {
      name: "Продолжить черновик статьи",
      exact: true,
    }),
  ).toHaveCount(0);
});

async function openTags(page: Page, select = true) {
  await page.goto("/feed");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Выбрать хештеги", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Теги публикации" });
  if (select) await form.getByRole("button", { name: /Подборки/ }).click();
  return form;
}
test("tags: real 409 requires review before replacing another admin's version", async ({
  page,
}) => {
  const sent = writes(page, "admin.updatePost");
  let form = await openTags(page);
  const other = await otherPage(page);
  await openPost(other, "quick");
  await text(other).fill("OTHER_EDITOR_BEFORE_TAGS");
  await save(other).click();
  await expect(text(other)).toHaveCount(0);
  const selected = await page.evaluate(
    () => JSON.parse(localStorage.getItem("darcy:tag-draft:501:71")!).tags,
  );
  await page.reload();
  form = await openTags(page, false);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("darcy:tag-draft:501:71")!).tags,
    ),
  ).toEqual(selected);
  const conflict = page.waitForResponse(
    (r) => r.url().includes("admin.updatePost") && r.status() === 409,
  );
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await conflict;
  await expect(compare(page)).toBeVisible();
  await compare(page).click();
  expect(sent).toHaveLength(1);
  await accept(page).click();
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(sent).toHaveLength(2);
  expect(
    (await rows("SELECT text,tags FROM posts WHERE id=71"))[0],
  ).toMatchObject({ text: "OTHER_EDITOR_BEFORE_TAGS", tags: sent[1].tags });
});
test("tags: actual 412 preserves selection; the next account receives only its own draft", async ({
  page,
  context,
}) => {
  const sent = writes(page, "admin.updatePost");
  const form = await openTags(page);
  const selected = await page.evaluate(
    () => JSON.parse(localStorage.getItem("darcy:tag-draft:501:71")!).tags,
  );
  await page.route("**/api/trpc/admin.updatePost**", rejectMissingRevision);
  const rejected = page.waitForResponse(
    (r) => r.url().includes("admin.updatePost") && r.status() === 412,
  );
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await rejected;
  await expect(compare(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("darcy:tag-draft:501:71")!).tags,
    ),
  ).toEqual(selected);
  expect((await rows("SELECT tags FROM posts WHERE id=71"))[0].tags).toEqual([
    "community",
  ]);
  expect(sent).toHaveLength(1);
  await page.unroute("**/api/trpc/admin.updatePost**", rejectMissingRevision);
  await logout(context);
  await login(context, 502);
  await openTags(page, false);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("darcy:tag-draft:502:71") ?? "null")
            ?.tags,
      ),
    )
    .toEqual(["community"]);
  expect(sent).toHaveLength(1);
});
test("tags: a lost ACK is confirmed by real detail without another mutation", async ({
  page,
}) => {
  const sent = writes(page, "admin.updatePost");
  const form = await openTags(page);
  const lost = await loseNextAck(page, "admin.updatePost");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await lost.done;
  await form
    .getByRole("button", { name: "Обновить публикации", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  expect(sent).toHaveLength(1);
  expect((await rows("SELECT tags FROM posts WHERE id=71"))[0].tags).toEqual(
    sent[0].tags,
  );
});
