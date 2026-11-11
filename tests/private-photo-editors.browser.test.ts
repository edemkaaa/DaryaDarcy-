import { afterAll, beforeAll, expect, it } from "vitest";
import { expect as ui, type Page, type Locator } from "@playwright/test";
import { statfs } from "node:fs/promises";
import sharp from "sharp";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { editorApi, failure, ok } from "../apps/frontend/e2e/editor-fixtures";
import { gotoWithSession } from "../apps/frontend/e2e/layout-fixtures";

const enabled = process.env.DARYADARCY_LOCAL_BROWSER === "1";
const native = enabled ? it : it.skip;
let app: Awaited<ReturnType<typeof privateFilesBrowser>>;
let png: Buffer;
const assetId = "3af23d8c-140f-454b-a123-123456789abc";
beforeAll(async () => {
  if (!enabled) return;
  const disk = await statfs(process.cwd());
  if (disk.bavail * disk.bsize < 2 * 1024 ** 3)
    throw new Error("Own browser fixture requires at least 2 GiB free");
  png = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 25, g: 50, b: 75, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  app = await privateFilesBrowser("http://127.0.0.1:1");
}, 60000);
afterAll(async () => {
  await app?.close();
});
async function ownPage() {
  // Создаёт изолированную страницу и запрещает все запросы за пределы локального origin.

  const context = await app.context.browser()!.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === app.origin
      ? route.continue()
      : route.abort(),
  );
  return context.newPage();
}
async function open(page: Page, mode: "full" | "quick") {
  // Открывает полный либо быстрый редактор и дожидается завершения проверки durable-черновика.

  await gotoWithSession(
    page,
    `${app.origin}${mode === "full" ? "/admin" : "/feed"}`,
  );
  await page
    .getByRole("button", {
      name: mode === "full" ? "Новый" : "Новый пост",
      exact: true,
    })
    .click();
  const form = page.getByRole("dialog", { name: "Редактор публикации" });
  await ui(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(0);
  return form;
}
async function choose(page: Page, form: Locator) {
  // Выбирает синтетический PNG и проверяет декодирование локального blob-превью.

  const chooser = page.waitForEvent("filechooser");
  await form
    .getByRole("button", { name: "Выбрать из галереи", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
  await ui
    .poll(() =>
      form
        .locator('img[src^="blob:"]')
        .first()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(4);
}
const submit = (form: Locator, mode: "full" | "quick") =>
  /* Находит кнопку сохранения полного редактора или публикации быстрого без принудительного клика. */ form
    .getByRole("button", {
      name: mode === "full" ? "Сохранить" : "Опубликовать",
      exact: true,
    })
    .first();
function receipt(input: Record<string, unknown>) {
  // Возвращает согласованную квитанцию частного postPhoto вместо обращения к S3.

  return {
    state: "ready",
    assetId,
    usage: "postPhoto",
    filename: input.filename,
    mimeType: "image/webp",
    fileSize: 80,
    url: `/api/media/content-files/${assetId}`,
  };
}

// Одинаковые инварианты приватности и восстановления проверяются на полном и быстром редакторах; различие замены/добавления фото остаётся явным в ожиданиях.
for (const mode of ["full", "quick"] as const) {
  native(
    `${mode}: local preview and real IndexedDB survive lost upload/create responses without duplicate writes`,
    async () => {
      // Сценарий: Оба редактора сохраняют локальное превью и IndexedDB после потери upload/create ACK без лишних записей.

      const page = await ownPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(60000);
      try {
        const uploads: Record<string, unknown>[] = [],
          creates: Record<string, unknown>[] = [],
          statuses: Record<string, unknown>[] = [];
        let publicWrites = 0,
          unboundReads = 0;
        const messages: string[] = [];
        page.on("dialog", async (dialog) => {
          messages.push(dialog.message());
          await dialog.accept();
        });
        page.on("request", (request) => {
          if (
            new URL(request.url()).pathname.startsWith(
              "/api/media/content-files/",
            )
          )
            unboundReads++;
        });
        await editorApi(page, (name, input) => {
          if (name === "admin.uploadPhoto") publicWrites++;
          if (name === "admin.uploadPrivateContentFile") {
            uploads.push(input);
            return failure(503);
          }
          if (name === "admin.privateContentFileStatus") {
            statuses.push(input);
            return ok(receipt(uploads[0]));
          }
          if (name === "admin.createPost") {
            creates.push(input);
            return creates.length === 1 ? failure(503) : ok(42);
          }
        });
        let form = await open(page, mode);
        await ui(
          form.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
        await form
          .getByPlaceholder("Текст поста… Enter — новый абзац")
          .fill("PRIVATE_PHOTO_RECOVERY");
        await choose(page, form);
        expect(uploads).toHaveLength(0);
        expect(publicWrites).toBe(0);
        await submit(form, mode).click();
        await ui(
          form.getByRole("button", {
            name: "Проверить сохранение",
            exact: true,
          }),
        ).toBeVisible();
        expect(uploads).toHaveLength(1);
        const prepared = await sharp(
          Buffer.from(String(uploads[0].base64), "base64"),
        ).metadata();
        expect(prepared.width).toBe(4);
        expect(prepared.hasAlpha).toBe(true);
        form = await open(page, mode);
        await form
          .getByRole("button", { name: "Восстановить черновик", exact: true })
          .click();
        await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
        await form
          .getByRole("button", { name: "Проверить сохранение", exact: true })
          .click();
        await ui(submit(form, mode)).toBeEnabled();
        expect(statuses).toEqual([
          { idempotencyKey: uploads[0].idempotencyKey },
        ]);
        expect(creates).toHaveLength(0);
        await submit(form, mode).click();
        await ui(
          form.getByRole("button", {
            name: "Проверить сохранение",
            exact: true,
          }),
        ).toBeVisible();
        form = await open(page, mode);
        await form
          .getByRole("button", { name: "Восстановить черновик", exact: true })
          .click();
        await form
          .getByRole("button", { name: "Проверить сохранение", exact: true })
          .click();
        await ui(form).toHaveCount(0);
        expect(uploads).toHaveLength(1);
        expect(creates).toHaveLength(2);
        expect(creates[1]).toEqual(creates[0]);
        expect(creates[0].photos).toEqual([
          `/api/media/content-files/${assetId}`,
        ]);
        expect(publicWrites).toBe(0);
        expect(unboundReads).toBe(0);
        expect(
          messages.every(
            (message) => !message.includes("PRIVATE_INTERNAL_DETAILS"),
          ),
        ).toBe(true);
      } finally {
        await page.context().close();
      }
    },
    180000,
  );

  native(
    `${mode}: closing the editor revokes its local photo URL without a public upload`,
    async () => {
      // Сценарий: Закрытие редактора отзывает blob-превью без публичной загрузки.

      const page = await ownPage();
      page.setDefaultNavigationTimeout(60000);
      try {
        let writes = 0;
        page.on("dialog", (dialog) => dialog.accept());
        await editorApi(page, (name) => {
          if (/admin\.(upload|createPost|updatePost)/.test(name)) writes++;
        });
        const form = await open(page, mode);
        await ui(
          form.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
        await choose(page, form);
        const url = await form
          .locator('img[src^="blob:"]')
          .first()
          .getAttribute("src");
        await form
          .getByRole("button", { name: "Закрыть редактор", exact: true })
          .click();
        await ui(form).toHaveCount(0);
        expect(
          await page.evaluate(async (url) => {
            try {
              await fetch(url!);
              return "readable";
            } catch {
              return "revoked";
            }
          }, url),
        ).toBe("revoked");
        expect(writes).toBe(0);
      } finally {
        await page.context().close();
      }
    },
    120000,
  );

  for (const phase of ["upload", "status"] as const) {
    native(
      `${mode}: live account switch during ${phase} ignores the old receipt and preserves the original owner's file`,
      async () => {
        // Сценарий: Смена аккаунта при upload/status игнорирует позднюю квитанцию и сохраняет File первоначальному владельцу.

        const page = await ownPage();
        page.setDefaultNavigationTimeout(60000);
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        try {
          let owner = 101;
          const uploads: Record<string, unknown>[] = [],
            statuses: { owner: number; input: Record<string, unknown> }[] = [];
          let writes = 0;
          page.on("dialog", (dialog) => dialog.accept());
          await editorApi(page, async (name, input) => {
            if (name === "admin.uploadPrivateContentFile") {
              uploads.push(input);
              if (phase === "status") return failure(503);
              await held;
              return ok(receipt(input));
            }
            if (name === "admin.privateContentFileStatus") {
              statuses.push({ owner, input });
              await held;
              return ok(receipt(uploads[0]));
            }
            if (name === "admin.createPost" || name === "admin.updatePost")
              writes++;
          });
          await page.route("**/api/auth/me", (route) =>
            route.fulfill({
              json: {
                user: {
                  id: owner,
                  openId: `test-${owner}`,
                  role: "admin",
                  name: "Admin",
                  email: `${owner}@example.test`,
                  lastSignedIn: "2026-10-16T10:00:00Z",
                },
              },
            }),
          );
          let form = await open(page, mode);
          await ui(
            form.getByText("Черновик сохранён на этом устройстве", {
              exact: true,
            }),
          ).toBeVisible();
          await form
            .getByPlaceholder("Текст поста… Enter — новый абзац")
            .fill("OWNER_101_PRIVATE_PHOTO");
          await choose(page, form);
          await submit(form, mode).click();
          await ui.poll(() => uploads.length).toBe(1);
          if (phase === "status") {
            await form
              .getByRole("button", {
                name: "Проверить сохранение",
                exact: true,
              })
              .click();
            await ui.poll(() => statuses.length).toBe(1);
          }
          owner = 202;
          await page.evaluate(() => window.dispatchEvent(new Event("online")));
          await ui(form).toHaveCount(0);
          await page
            .getByRole("button", {
              name: mode === "full" ? "Новый" : "Новый пост",
              exact: true,
            })
            .click();
          form = page.getByRole("dialog", { name: "Редактор публикации" });
          await ui(
            form.getByText("Черновик сохранён на этом устройстве", {
              exact: true,
            }),
          ).toBeVisible();
          await ui(form.locator('img[src^="blob:"]')).toHaveCount(0);
          await ui(
            form.getByPlaceholder("Текст поста… Enter — новый абзац"),
          ).toHaveValue("");
          release();
          expect(writes).toBe(0);
          owner = 101;
          form = await open(page, mode);
          await form
            .getByRole("button", { name: "Восстановить черновик", exact: true })
            .click();
          await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
          await ui(
            form.getByPlaceholder("Текст поста… Enter — новый абзац"),
          ).toHaveValue("OWNER_101_PRIVATE_PHOTO");
          await form
            .getByRole("button", { name: "Проверить сохранение", exact: true })
            .click();
          await ui(submit(form, mode)).toBeEnabled();
          expect(uploads).toHaveLength(1);
          expect(
            statuses.every(
              (status) =>
                status.owner === 101 &&
                status.input.idempotencyKey === uploads[0].idempotencyKey,
            ),
          ).toBe(true);
          expect(writes).toBe(0);
        } finally {
          release();
          await page.context().close();
        }
      },
      120000,
    );
  }
  native(
    `${mode}: removing a selected photo revokes its preview and never uploads the removed file`,
    async () => {
      // Сценарий: Удаление выбранного фото отзывает его превью и публикует без удалённого файла.

      const page = await ownPage();
      page.setDefaultNavigationTimeout(60000);
      try {
        let uploads = 0;
        const creates: Record<string, unknown>[] = [];
        page.on("dialog", (dialog) => dialog.accept());
        await editorApi(page, (name, input) => {
          if (
            name === "admin.uploadPhoto" ||
            name === "admin.uploadPrivateContentFile"
          )
            uploads++;
          if (name === "admin.createPost") creates.push(input);
        });
        let form = await open(page, mode);
        await ui(
          form.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
        await form
          .getByPlaceholder("Текст поста… Enter — новый абзац")
          .fill("WITHOUT_REMOVED_PHOTO");
        await choose(page, form);
        await ui(
          form.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
        form = await open(page, mode);
        await ui(
          form.getByText("Незавершённый черновик восстановлен автоматически.", {
            exact: true,
          }),
        ).toBeVisible();
        await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
        const url = await form
          .locator('img[src^="blob:"]')
          .first()
          .getAttribute("src");
        await form
          .getByRole("button", { name: "Удалить фото 1", exact: true })
          .click();
        await ui(form.locator('img[src^="blob:"]')).toHaveCount(0);
        expect(
          await page.evaluate(async (url) => {
            try {
              await fetch(url!);
              return "readable";
            } catch {
              return "revoked";
            }
          }, url),
        ).toBe("revoked");
        await submit(form, mode).click();
        await ui(form).toHaveCount(0);
        expect(uploads).toBe(0);
        expect(creates[0].photos).toEqual([]);
      } finally {
        await page.context().close();
      }
    },
    120000,
  );

  native(
    `${mode}: editing preserves existing links and replays a missing upload with the original bytes/key`,
    async () => {
      // Сценарий: Редактирование сохраняет старые ссылки и повторяет отсутствующую загрузку с теми же байтами и ключом.

      const page = await ownPage();
      page.setDefaultNavigationTimeout(60000);
      try {
        const oldPhoto = `${app.origin}/cf-synthetic-old.png`;
        const existing = {
          id: 7,
          text: "EXISTING_SYNTHETIC_POST",
          photos: [oldPhoto],
          tags: [],
          status: "published",
          published: true,
          target: "feed",
          sortOrder: 0,
          scheduledAt: null,
          richText: null,
          createdAt: "2026-10-16T10:00:00Z",
          publishedAt: "2026-10-16T10:00:00Z",
          media: [],
          likeCount: 0,
          commentCount: 0,
        };
        const uploads: Record<string, unknown>[] = [],
          updates: Record<string, unknown>[] = [];
        let creates = 0,
          publicWrites = 0;
        page.on("dialog", (dialog) => dialog.accept());
        await editorApi(page, (name, input) => {
          if (name === "admin.posts") return ok([existing]);
          if (name === "feed.listPaginated")
            return ok({ posts: [existing], nextCursor: null });
          if (name === "admin.uploadPhoto") publicWrites++;
          if (name === "admin.uploadPrivateContentFile") {
            uploads.push(input);
            return uploads.length === 1 ? failure(503) : ok(receipt(input));
          }
          if (name === "admin.privateContentFileStatus")
            return ok({ state: "notRecorded" });
          if (name === "admin.updatePost") updates.push(input);
          if (name === "admin.createPost") creates++;
        });
        await page.route("**/cf-synthetic-old.png", (route) =>
          route.fulfill({ contentType: "image/png", body: png }),
        );
        await gotoWithSession(
          page,
          `${app.origin}${mode === "full" ? "/admin" : "/feed"}`,
        );
        if (mode === "quick")
          await page
            .getByRole("button", { name: "Действия с постом", exact: true })
            .first()
            .click();
        await page
          .getByRole("button", { name: "Редактировать пост", exact: true })
          .first()
          .click();
        const form = page.getByRole("dialog", { name: "Редактор публикации" });
        await ui(
          form.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
        if (mode === "full") await choose(page, form);
        else {
          const chooser = page.waitForEvent("filechooser");
          await form
            .getByRole("button", { name: "Заменить фото 1", exact: true })
            .click();
          await (
            await chooser
          ).setFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
          await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
        }
        await form
          .getByRole("button", { name: "Сохранить", exact: true })
          .first()
          .click();
        await form
          .getByRole("button", { name: "Проверить сохранение", exact: true })
          .click();
        await ui(
          form.getByRole("button", { name: "Сохранить", exact: true }).first(),
        ).toBeEnabled();
        expect(updates).toHaveLength(0);
        await form
          .getByRole("button", { name: "Сохранить", exact: true })
          .first()
          .click();
        await ui(form).toHaveCount(0);
        expect(uploads).toHaveLength(2);
        expect(uploads[1]).toEqual(uploads[0]);
        expect(updates).toHaveLength(1);
        expect(updates[0].photos).toEqual(
          mode === "full"
            ? [oldPhoto, `/api/media/content-files/${assetId}`]
            : [`/api/media/content-files/${assetId}`],
        );
        expect(creates).toBe(0);
        expect(publicWrites).toBe(0);
      } finally {
        await page.context().close();
      }
    },
    120000,
  );
}
