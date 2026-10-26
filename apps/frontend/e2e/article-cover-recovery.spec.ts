import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const coverUrl = "https://cover.example.test/ready.jpg";
const oldCover = (id: number) => `https://cover.example.test/old-${id}.jpg`;
const title = (page: Page) => page.getByPlaceholder("Что посмотреть осенью...");
const body = (page: Page) =>
  page.getByPlaceholder(
    "Абзац. Пустая строка — новый абзац. Ссылка: [название](https://...)",
  );
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const check = (page: Page) => button(page, "Проверить загрузку баннера");
const retry = (page: Page) => button(page, "Повторить загрузку баннера");
const restore = (page: Page) => button(page, "Восстановить загрузку баннера");
function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function fixture(page: Page) {
  const state = {
    user: {
      id: 101,
      openId: "cover-admin",
      name: "Cover admin",
      email: "cover@example.test",
      role: "admin",
      lastSignedIn: "2026-10-26T10:00:00Z",
    },
    mode: "ok" as
      | "ok"
      | "lost"
      | "missing"
      | "pending"
      | "conflict"
      | "invalid",
    statusFails: false,
    articleLost: false,
    ready: new Set<string>(),
    uploads: [] as Record<string, unknown>[],
    statuses: [] as Record<string, unknown>[],
    writes: [] as { name: string; input: Record<string, unknown> }[],
    privateUploads: [] as Record<string, unknown>[],
    legacyUploads: 0,
    gate: null as ReturnType<typeof barrier> | null,
    released: false,
  };
  const raster = await sharp({
    create: { width: 480, height: 240, channels: 3, background: "#827159" },
  })
    .png()
    .toBuffer();
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.fallback()
      : route.abort(),
  );
  await page.route("https://cover.example.test/**", (route) =>
    route.fulfill({ contentType: "image/png", body: raster }),
  );
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({ contentType: "image/png", body: raster }),
  );
  page.on("dialog", (dialog) => dialog.accept());
  await editorApi(page, async (name, input) => {
    if (name === "admin.articles")
      return ok(
        [701, 702].map((id) => ({
          id,
          title: `COVER_ARTICLE_${id}`,
          coverUrl: oldCover(id),
          access: "club",
          published: false,
          sections: [{ type: "text", text: `BODY_${id}` }],
        })),
      );
    if (name === "admin.uploadPhoto") {
      state.legacyUploads++;
      return failure(500);
    }
    if (name === "admin.uploadPublicCover") {
      state.uploads.push(input);
      await state.gate?.promise;
      state.released = true;
      if (state.mode === "conflict") return failure(409);
      if (["missing", "pending"].includes(state.mode)) return failure(503);
      state.ready.add(input.idempotencyKey as string);
      if (state.mode === "lost") return failure(503);
      return ok({
        state: "ready",
        url: coverUrl,
        avatarApplied: state.mode === "invalid",
        isCurrent: null,
      });
    }
    if (name === "admin.publicCoverUploadStatus") {
      state.statuses.push(input);
      if (state.statusFails) return failure(503);
      if (state.mode === "conflict") return failure(409);
      return ok(
        state.ready.has(input.idempotencyKey as string)
          ? {
              state: "ready",
              url: coverUrl,
              avatarApplied: false,
              isCurrent: null,
            }
          : { state: state.mode === "pending" ? "pending" : "missing" },
      );
    }
    if (name === "admin.privateContentFileStatus")
      return ok({ state: "notRecorded" });
    if (name === "admin.uploadPrivateContentFile") {
      state.privateUploads.push(input);
      return ok({
        state: "ready",
        assetId: "00000000-0000-4000-8000-000000000001",
        usage: input.usage,
        filename: input.filename,
        mimeType: input.mimeType,
        fileSize: Buffer.from(input.base64 as string, "base64").length,
        url: "/api/media/content-files/00000000-0000-4000-8000-000000000001",
      });
    }
    if (name === "admin.articleCreationStatus" && state.articleLost)
      return ok({ status: "created", articleId: 900 });
    if (["admin.createArticle", "admin.updateArticle"].includes(name)) {
      state.writes.push({ name, input });
      return state.articleLost
        ? failure(503)
        : name === "admin.createArticle"
          ? ok(900)
          : ok({ ok: true });
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: state.user } }),
  );
  return { state, raster };
}
async function open(page: Page) {
  await gotoWithSession(page, "/admin");
  await button(page, "Статьи").click();
}
async function edit(page: Page, id: number) {
  await page
    .getByText(`COVER_ARTICLE_${id}`, { exact: true })
    .locator("..")
    .getByRole("button", { name: "Править", exact: true })
    .click();
  await expect(title(page)).toHaveValue(`COVER_ARTICLE_${id}`);
}
async function choose(page: Page, raster: Buffer, existing = true) {
  const chooser = page.waitForEvent("filechooser");
  await button(page, existing ? "Сменить баннер" : "Выбрать баннер").click();
  await (
    await chooser
  ).setFiles({ name: "cover.png", mimeType: "image/png", buffer: raster });
}
async function stored(page: Page, ownerId = 101) {
  return page.evaluate(
    async (owner) =>
      new Promise<{
        idempotencyKey: string;
        upload: Record<string, unknown>;
        snapshot: Record<string, unknown>;
        files: unknown[];
      } | null>((resolve, reject) => {
        const request = indexedDB.open("darcy-article-covers", 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("operations", "readonly");
          const read = tx.objectStore("operations").get(owner);
          read.onsuccess = () => resolve(read.result ?? null);
          tx.oncomplete = () => db.close();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    ownerId,
  );
}

test("a successful cover upload changes only the editor until an explicit article save", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  await open(page);
  await edit(page, 701);
  await choose(page, raster);
  await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.uploads).toHaveLength(1);
  expect(state.legacyUploads).toBe(0);
  expect(await stored(page)).toBeNull();
  await button(page, "Сохранить").click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({
    name: "admin.updateArticle",
    input: { id: 701, coverUrl, title: "COVER_ARTICLE_701" },
  });
});

test("a lost response restores the exact new article and private file after reload without another cover upload", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.mode = "lost";
  await open(page);
  await button(page, "Написать статью").click();
  await title(page).fill("UNSAVED_COVER_ARTICLE");
  await body(page).fill("UNSAVED_BODY");
  await button(page, "Статус: опубликована").click();
  await button(page, "Ссылка").first().click();
  const chooser = page.waitForEvent("filechooser");
  await button(page, "Загрузить файл").click();
  await (
    await chooser
  ).setFiles({
    name: "draft.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("ORIGINAL_PRIVATE_BYTES"),
  });
  await expect(
    page.getByPlaceholder("Текст ссылки, например Смотреть трейлер"),
  ).toHaveValue("draft.txt");
  await choose(page, raster, false);
  await expect(check(page)).toBeEnabled();
  const intent = await stored(page);
  expect(intent?.upload).toMatchObject({
    base64: state.uploads[0].base64,
    purpose: "publicCover",
  });
  await page.reload();
  await button(page, "Статьи").click();
  await restore(page).click();
  await expect(title(page)).toHaveValue("UNSAVED_COVER_ARTICLE");
  await expect(body(page)).toHaveValue("UNSAVED_BODY");
  await expect(
    page.getByPlaceholder("Текст ссылки, например Смотреть трейлер"),
  ).toHaveValue("draft.txt");
  await check(page).click();
  await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.writes).toEqual([]);
  expect(state.privateUploads).toEqual([]);
  await button(page, "Сохранить черновик").click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(
    Buffer.from(state.privateUploads[0].base64 as string, "base64").toString(),
  ).toBe("ORIGINAL_PRIVATE_BYTES");
  expect(state.writes[0].input).toMatchObject({
    title: "UNSAVED_COVER_ARTICLE",
    coverUrl,
    published: false,
  });
});

for (const mode of ["missing", "pending"] as const)
  test(`${mode} cover retries the identical bytes and key after a status read`, async ({
    page,
  }) => {
    const { state, raster } = await fixture(page);
    state.mode = mode;
    await open(page);
    await edit(page, 701);
    await choose(page, raster);
    await expect(check(page)).toBeEnabled();
    await page.reload();
    await button(page, "Статьи").click();
    await restore(page).click();
    await check(page).click();
    await expect(retry(page)).toBeVisible();
    state.mode = "ok";
    await retry(page).click();
    await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
    expect(state.uploads).toHaveLength(2);
    expect(state.uploads[1]).toEqual(state.uploads[0]);
    expect(state.statuses).toHaveLength(2);
    expect(state.writes).toEqual([]);
  });

test("ready discovered immediately before retry avoids a duplicate cover upload", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.mode = "missing";
  await open(page);
  await edit(page, 701);
  await choose(page, raster);
  await check(page).click();
  await expect(retry(page)).toBeVisible();
  state.ready.add(state.uploads[0].idempotencyKey as string);
  await retry(page).click();
  await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.writes).toEqual([]);
});

test("status failure keeps the journal and does not unlock blind retry", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.mode = "missing";
  state.statusFails = true;
  await open(page);
  await edit(page, 701);
  await choose(page, raster);
  await expect(check(page)).toBeEnabled();
  const intent = await stored(page);
  await check(page).click();
  await expect.poll(() => state.statuses.length).toBe(1);
  await expect(check(page)).toBeEnabled();
  await expect(retry(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(intent);
  expect(state.uploads).toHaveLength(1);
});

test("a conflict needs explicit discard before choosing a new cover", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.mode = "conflict";
  await open(page);
  await edit(page, 701);
  await choose(page, raster);
  await expect(page.getByText(/Конфликт загрузки баннера/)).toBeVisible();
  await expect(retry(page)).toHaveCount(0);
  await button(page, "Отменить загрузку баннера").click();
  await expect(button(page, "Сменить баннер")).toBeEnabled();
  expect(await stored(page)).toBeNull();
  state.mode = "ok";
  await choose(page, raster);
  await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
  expect(state.uploads[1].idempotencyKey).not.toBe(
    state.uploads[0].idempotencyKey,
  );
  expect(state.writes).toEqual([]);
});

test("an avatar receipt is not accepted as a public cover receipt", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.mode = "invalid";
  await open(page);
  await edit(page, 701);
  await choose(page, raster);
  await expect(check(page)).toBeEnabled();
  await expect(page.locator(`img[src="${oldCover(701)}"]`)).toBeVisible();
  expect(await stored(page)).not.toBeNull();
  expect(state.writes).toEqual([]);
});

test("a delayed upload cannot replace another article's cover", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.gate = barrier();
  try {
    await open(page);
    await edit(page, 701);
    await choose(page, raster);
    await expect.poll(() => state.uploads.length).toBe(1);
    await button(page, "Отмена").click();
    await edit(page, 702);
    state.gate.release();
    await expect.poll(() => state.released).toBe(true);
    await expect(page.locator(`img[src="${oldCover(702)}"]`)).toBeVisible();
    await expect(title(page)).toHaveValue("COVER_ARTICLE_702");
    expect(state.writes).toEqual([]);
    expect((await stored(page))?.snapshot.editingId).toBe(701);
    await button(page, "Отмена").click();
    await restore(page).click();
    await check(page).click();
    await expect(title(page)).toHaveValue("COVER_ARTICLE_701");
    await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
    expect(state.uploads).toHaveLength(1);
  } finally {
    state.gate.release();
  }
});

test("a cancelled new article cannot donate its banner to a different new draft", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.mode = "lost";
  await open(page);
  await button(page, "Написать статью").click();
  await title(page).fill("FIRST_DRAFT");
  await choose(page, raster, false);
  await expect(check(page)).toBeEnabled();
  await button(page, "Отмена").click();
  await button(page, "Написать статью").click();
  await title(page).fill("SECOND_DRAFT");
  await expect(check(page)).toHaveCount(0);
  await expect(page.locator(`img[src="${coverUrl}"]`)).toHaveCount(0);
  await button(page, "Отмена").click();
  await restore(page).click();
  await expect(title(page)).toHaveValue("FIRST_DRAFT");
  await check(page).click();
  await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("another account cannot restore or apply an old upload, including a late response", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.gate = barrier();
  try {
    await open(page);
    await edit(page, 701);
    await choose(page, raster);
    await expect.poll(() => state.uploads.length).toBe(1);
    state.user = { ...state.user, id: 202, openId: "second-admin" };
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "202",
        }),
      ),
    );
    await button(page, "Статьи").click();
    await edit(page, 702);
    state.gate.release();
    await expect.poll(() => state.released).toBe(true);
    await expect(page.locator(`img[src="${oldCover(702)}"]`)).toBeVisible();
    await button(page, "Отмена").click();
    await expect(restore(page)).toHaveCount(0);
    expect(state.statuses).toEqual([]);
    expect(state.writes).toEqual([]);
    expect(await stored(page, 101)).not.toBeNull();
    expect(await stored(page, 202)).toBeNull();
  } finally {
    state.gate.release();
  }
});

test("IndexedDB write failure prevents an upload without a durable intent", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  await open(page);
  await edit(page, 701);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === "darcy-article-covers")
        throw new DOMException("full", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await choose(page, raster);
  await expect(page.getByText(/Загрузка не отправлена/)).toBeVisible();
  expect(state.uploads).toEqual([]);
  expect(state.writes).toEqual([]);
  await expect(button(page, "Сменить баннер")).toBeEnabled();
});

test("a stale second tab cannot overwrite the first tab's durable cover intent", async ({
  page,
  context,
}) => {
  const first = await fixture(page);
  first.state.mode = "missing";
  const other = await context.newPage();
  try {
    const second = await fixture(other);
    await open(page);
    await edit(page, 701);
    await open(other);
    await edit(other, 702);
    await choose(page, first.raster);
    await expect(check(page)).toBeEnabled();
    const original = await stored(page);
    await choose(other, second.raster);
    await expect(
      other.getByText(/Есть предыдущая загрузка баннера/),
    ).toBeVisible();
    expect(second.state.uploads).toEqual([]);
    expect(await stored(other)).toEqual(original);
    await expect(title(other)).toHaveValue("COVER_ARTICLE_702");
    await button(other, "Отмена").click();
    await restore(other).click();
    await expect(title(other)).toHaveValue("COVER_ARTICLE_701");
    expect(second.state.writes).toEqual([]);
  } finally {
    await other.close();
  }
});

test("unavailable browser storage can be rechecked before choosing a cover", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    let fail = true;
    IDBFactory.prototype.open = function (...args) {
      if (fail && args[0] === "darcy-article-covers")
        throw new DOMException("blocked", "SecurityError");
      return original.apply(this, args);
    };
    Object.assign(window, {
      allowCoverStorage: () => {
        fail = false;
      },
    });
  });
  await open(page);
  await expect(
    page.getByText(/Не удалось прочитать загрузку баннера/),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { allowCoverStorage: () => void }
    ).allowCoverStorage(),
  );
  await button(page, "Повторить чтение загрузки баннера").click();
  await edit(page, 701);
  await choose(page, raster);
  await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.writes).toEqual([]);
});

test("pending article creation is resolved before restoring a different draft's cover", async ({
  page,
}) => {
  const { state, raster } = await fixture(page);
  state.mode = "lost";
  await open(page);
  await button(page, "Написать статью").click();
  await title(page).fill("COVER_DRAFT_A");
  await choose(page, raster, false);
  await expect(check(page)).toBeEnabled();
  await button(page, "Отмена").click();
  await button(page, "Написать статью").click();
  await title(page).fill("CREATION_DRAFT_B");
  state.articleLost = true;
  await button(page, "Опубликовать").click();
  await expect(button(page, "Проверить сохранение")).toBeEnabled();
  await button(page, "Отмена").click();
  await expect(restore(page)).toBeDisabled();
  await button(page, "Восстановить создание статьи").click();
  await expect(title(page)).toHaveValue("CREATION_DRAFT_B");
  await button(page, "Проверить сохранение").click();
  await expect(restore(page)).toBeEnabled();
  await restore(page).click();
  await expect(title(page)).toHaveValue("COVER_DRAFT_A");
  await check(page).click();
  await expect(page.locator(`img[src="${coverUrl}"]`)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].input.title).toBe("CREATION_DRAFT_B");
  expect(state.uploads).toHaveLength(1);
});
