import { afterAll, beforeAll, expect, it } from "vitest";
import { expect as ui, type Page } from "@playwright/test";
import { statfs } from "node:fs/promises";
import sharp from "sharp";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { editorApi, ok } from "../apps/frontend/e2e/editor-fixtures";
import { gotoWithSession } from "../apps/frontend/e2e/layout-fixtures";

const native = process.env.DARYADARCY_LOCAL_BROWSER === "1" ? it : it.skip;
let app: Awaited<ReturnType<typeof privateFilesBrowser>>, png: Buffer;
beforeAll(async () => {
  if (process.env.DARYADARCY_LOCAL_BROWSER !== "1") return;
  const disk = await statfs(process.cwd());
  if (disk.bavail * disk.bsize < 2 * 1024 ** 3)
    throw new Error(
      "Own upload capability browser fixture requires 2 GiB free",
    );
  png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  app = await privateFilesBrowser("http://127.0.0.1:1");
}, 60000);
afterAll(async () => {
  await app?.close();
});
async function ownPage() {
  const context = await app.context.browser()!.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === app.origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(90000);
  page.on("dialog", (dialog) => dialog.accept());
  return page;
}
async function open(page: Page, mode: "full" | "quick") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await gotoWithSession(
      page,
      app.origin + (mode === "full" ? "/admin" : "/feed"),
    );
  } catch (error) {
    throw new Error(
      `${String(error)}; browser errors=${JSON.stringify(errors)}; body=${(await page.locator("body").innerText()).slice(0, 1000)}`,
    );
  }
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
for (const mode of ["full", "quick"] as const) {
  native(
    `${mode}: unavailable uploads disable only file actions and still allow a text post`,
    async () => {
      const page = await ownPage();
      let writes = 0,
        uploads = 0;
      try {
        await editorApi(page, (name) => {
          if (/upload/i.test(name)) uploads++;
          if (name === "admin.createPost") {
            writes++;
            return ok(42);
          }
        });
        // An older server advertises no private capabilities at all.
        await page.route("**/api/capabilities", (route) =>
          route.fulfill({ json: {} }),
        );
        const form = await open(page, mode);
        for (const name of [
          "Выбрать из галереи",
          "Выбрать видеофайл",
          "Аудио",
          "Документ",
        ])
          await ui(
            form.getByRole("button", { name, exact: true }),
          ).toBeDisabled();
        await form
          .getByPlaceholder("Текст поста… Enter — новый абзац")
          .fill("TEXT_WITH_UPLOADS_OFF");
        await form
          .getByRole("button", {
            name: mode === "full" ? "Сохранить" : "Опубликовать",
            exact: true,
          })
          .first()
          .click();
        await ui.poll(() => writes).toBe(1);
        expect(uploads).toBe(0);
      } finally {
        await page.context().close();
      }
    },
    120000,
  );
  native(
    `${mode}: disabling uploads after selection preserves the file without sending it or creating a post`,
    async () => {
      const page = await ownPage();
      let allowed = true,
        uploads = 0,
        creates = 0,
        checks = 0;
      const messages: string[] = [];
      page.on("dialog", (dialog) => {
        messages.push(dialog.message());
      });
      try {
        await editorApi(page, (name, input) => {
          if (name === "admin.uploadPrivateContentFile") {
            uploads++;
            return ok({
              state: "ready",
              assetId: "3af23d8c-140f-454b-a123-123456789abc",
              usage: "postPhoto",
              filename: input.filename,
              mimeType: "image/webp",
              fileSize: 80,
              url: "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc",
            });
          }
          if (name === "admin.createPost") {
            creates++;
            return ok(42);
          }
        });
        await page.route("**/api/capabilities", (route) => {
          checks++;
          return route.fulfill({
            json: {
              privateContentUploads: allowed,
              privatePostMediaUploads: allowed,
              privatePostVideoUploads: allowed,
            },
          });
        });
        const form = await open(page, mode);
        await form
          .getByPlaceholder("Текст поста… Enter — новый абзац")
          .fill("SELECTED_FILE_MUST_SURVIVE");
        const chooser = page.waitForEvent("filechooser");
        await form
          .getByRole("button", { name: "Выбрать из галереи", exact: true })
          .click();
        await (
          await chooser
        ).setFiles({ name: "own.png", mimeType: "image/png", buffer: png });
        await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
        const previousChecks = checks;
        allowed = false;
        await form
          .getByRole("button", {
            name: mode === "full" ? "Сохранить" : "Опубликовать",
            exact: true,
          })
          .first()
          .click();
        await ui.poll(() => checks).toBeGreaterThan(previousChecks);
        await ui.poll(() => messages.length).toBeGreaterThan(0);
        await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
        expect(uploads).toBe(0);
        expect(creates).toBe(0);
        await page.reload();
        const restored = await open(page, mode);
        await restored
          .getByRole("button", { name: "Восстановить черновик", exact: true })
          .click();
        await ui(
          restored.getByPlaceholder("Текст поста… Enter — новый абзац"),
        ).toHaveValue("SELECTED_FILE_MUST_SURVIVE");
        await ui(restored.locator('img[src^="blob:"]').first()).toBeVisible();
      } finally {
        await page.context().close();
      }
    },
    120000,
  );
}
native(
  "comment photos stay disabled without blocking a text-only comment",
  async () => {
    const page = await ownPage();
    let uploads = 0,
      comments = 0;
    try {
      await editorApi(page, (name) => {
        if (/upload/i.test(name)) uploads++;
        if (name === "club.subscription")
          return ok({
            hasClubAccess: true,
            subscribed: true,
            expiresAt: "2030-01-01T00:00:00Z",
            cancelAtPeriodEnd: false,
            isOwner: true,
            monthlyPrice: "790",
          });
        if (name === "club.list")
          return ok({
            posts: [
              {
                id: 1,
                text: "OWN_COMMENT_POST",
                tags: ["community"],
                target: "club",
                photos: [],
                media: [],
                createdAt: new Date().toISOString(),
                publishedAt: new Date().toISOString(),
                commentCount: 0,
                likeCount: 0,
              },
            ],
            nextCursor: null,
          });
        if (name === "club.comments") return ok([]);
        if (name === "club.addComment") {
          comments++;
          return ok({ id: 91 });
        }
      });
      await page.route("**/api/capabilities", (route) =>
        route.fulfill({ status: 503, json: { error: "Unavailable" } }),
      );
      await gotoWithSession(page, `${app.origin}/club`);
      await page
        .getByRole("button", { name: "Комьюнити", exact: true })
        .click();
      await ui(
        page.getByRole("button", { name: "Фото (0/2)", exact: true }),
      ).toBeDisabled();
      await page
        .getByPlaceholder("Написать комментарий...")
        .fill("TEXT_ONLY_COMMENT");
      await page
        .getByRole("button", { name: "Отправить", exact: true })
        .click();
      await ui.poll(() => comments).toBe(1);
      expect(uploads).toBe(0);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
native(
  "article private file actions stay disabled while public banner and text editing remain available",
  async () => {
    const page = await ownPage();
    try {
      await editorApi(page);
      await page.route("**/api/capabilities", (route) =>
        route.fulfill({ json: {} }),
      );
      await gotoWithSession(page, `${app.origin}/admin`);
      await page.getByRole("button", { name: "Статьи", exact: true }).click();
      await page
        .getByRole("button", { name: "Написать статью", exact: true })
        .click();
      await ui(
        page.getByRole("button", { name: "Выбрать баннер", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Фото", exact: true })
        .first()
        .click();
      await ui(
        page.getByRole("button", { name: "Выбрать фото", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Ссылка", exact: true })
        .first()
        .click();
      await ui(
        page.getByRole("button", { name: "Загрузить файл", exact: true }),
      ).toBeDisabled();
    } finally {
      await page.context().close();
    }
  },
  120000,
);

native(
  "a failed refresh does not retain an earlier enabled upload hint",
  async () => {
    const page = await ownPage();
    let fail = false,
      checks = 0;
    try {
      await editorApi(page);
      await page.route("**/api/capabilities", (route) => {
        checks++;
        return route.fulfill(
          fail
            ? { status: 503, json: { error: "Unavailable" } }
            : {
                json: {
                  privateContentUploads: true,
                  privatePostMediaUploads: true,
                  privatePostVideoUploads: true,
                },
              },
        );
      });
      const form = await open(page, "full");
      const choose = form.getByRole("button", {
        name: "Выбрать из галереи",
        exact: true,
      });
      await ui(choose).toBeEnabled();
      const previous = checks;
      fail = true;
      await page.clock.install();
      await page.clock.fastForward(61000);
      await page.evaluate(() =>
        window.dispatchEvent(new Event("visibilitychange")),
      );
      await ui.poll(() => checks).toBeGreaterThan(previous);
      await ui(choose).toBeDisabled();
    } finally {
      await page.context().close();
    }
  },
  120000,
);
