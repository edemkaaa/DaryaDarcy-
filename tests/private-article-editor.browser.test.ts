import { afterAll, beforeAll, expect, it } from "vitest";
import { expect as ui, type Page } from "@playwright/test";
import { statfs } from "node:fs/promises";
import sharp from "sharp";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { editorApi, ok, failure } from "../apps/frontend/e2e/editor-fixtures";
import { gotoWithSession } from "../apps/frontend/e2e/layout-fixtures";
const native = process.env.DARYADARCY_LOCAL_BROWSER === "1" ? it : it.skip;
let app: Awaited<ReturnType<typeof privateFilesBrowser>>, png: Buffer;
beforeAll(async () => {
  if (process.env.DARYADARCY_LOCAL_BROWSER !== "1") return;
  const disk = await statfs(process.cwd());
  if (disk.bavail * disk.bsize < 2 * 1024 ** 3)
    throw new Error("Own browser fixture requires 2 GiB free");
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
  const context = await app.context.browser()!.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === app.origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.on("dialog", (dialog) => dialog.accept());
  return page;
}
const title = (page: Page) => page.getByPlaceholder("Что посмотреть осенью...");
async function open(page: Page) {
  await gotoWithSession(page, `${app.origin}/admin`);
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
}
async function choose(
  page: Page,
  button: string,
  name: string,
  buffer = png,
  mimeType = "image/png",
) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: button, exact: true }).click(),
  ]);
  await chooser.setFiles({ name, mimeType, buffer });
}
const asset = (input: Record<string, unknown>, index: number) => ({
  state: "ready",
  assetId: `3af23d8c-140f-454b-a123-${String(index).padStart(12, "0")}`,
  usage: input.usage,
  filename: input.filename,
  mimeType:
    input.usage === "articleDocument"
      ? "text/plain; charset=utf-8"
      : "image/webp",
  fileSize:
    input.usage === "articleDocument"
      ? Buffer.from(String(input.base64), "base64").length
      : 80,
  url: `/api/media/content-files/3af23d8c-140f-454b-a123-${String(index).padStart(12, "0")}`,
});
native(
  "article photo/PNG/carousel/document stay private through lost upload/create responses and reload",
  async () => {
    const page = await ownPage();
    try {
      const uploads: Record<string, unknown>[] = [],
        creates: Record<string, unknown>[] = [],
        statuses: unknown[] = [];
      const receipts = new Map<string, ReturnType<typeof asset>>();
      let publicUploads = 0,
        unboundReads = 0;
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname.startsWith(
            "/api/media/content-files/",
          ) &&
          creates.length === 0
        )
          unboundReads++;
      });
      await editorApi(page, (name, input) => {
        if (name === "admin.uploadPhoto" || name === "admin.uploadMedia")
          publicUploads++;
        if (name === "admin.uploadPrivateContentFile") {
          uploads.push(input);
          const response = asset(input, uploads.length);
          receipts.set(String(input.idempotencyKey), response);
          return uploads.length === 1 ? failure(503) : ok(response);
        }
        if (name === "admin.privateContentFileStatus") {
          statuses.push(input);
          return ok(
            receipts.get(String(input.idempotencyKey)) ?? {
              state: "notRecorded",
            },
          );
        }
        if (name === "admin.articleCreationStatus")
          return ok({ status: "notRecorded" });
        if (name === "admin.createArticle") {
          creates.push(input);
          return creates.length === 1 ? failure(503) : ok(42);
        }
      });
      await open(page);
      await page
        .getByRole("button", { name: "Написать статью", exact: true })
        .click();
      await title(page).fill("PRIVATE_ARTICLE_FILES");
      await page
        .getByRole("button", { name: "Фото", exact: true })
        .first()
        .click();
      await choose(page, "Выбрать фото", "photo.png");
      await page
        .getByRole("button", { name: "PNG", exact: true })
        .first()
        .click();
      await choose(page, "Выбрать PNG без фона", "alpha.png");
      await page
        .getByRole("button", { name: "Карусель", exact: true })
        .first()
        .click();
      await choose(page, "Выбрать фото для карусели", "slide.png");
      await page
        .getByRole("button", { name: "Ссылка", exact: true })
        .first()
        .click();
      await choose(
        page,
        "Загрузить файл",
        "doc.txt",
        Buffer.from("private document"),
        "text/plain",
      );
      expect(uploads).toHaveLength(0);
      expect(publicUploads).toBe(0);
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(3);
      await page
        .getByRole("button", { name: "Опубликовать", exact: true })
        .click();
      await ui(
        page.getByRole("button", { name: "Проверить сохранение", exact: true }),
      ).toBeEnabled();
      expect(uploads).toHaveLength(1);
      expect(creates).toHaveLength(0);
      await open(page);
      await page
        .getByRole("button", {
          name: "Восстановить создание статьи",
          exact: true,
        })
        .click();
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(3);
      await page
        .getByRole("button", { name: "Проверить сохранение", exact: true })
        .click();
      await ui(
        page.getByRole("button", { name: "Повторить сохранение", exact: true }),
      ).toBeEnabled();
      expect(uploads).toHaveLength(4);
      expect(statuses).toEqual([{ idempotencyKey: uploads[0].idempotencyKey }]);
      expect(creates).toHaveLength(0);
      await page
        .getByRole("button", { name: "Повторить сохранение", exact: true })
        .click();
      await ui.poll(() => creates.length).toBe(1);
      await open(page);
      await page
        .getByRole("button", {
          name: "Восстановить создание статьи",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Повторить сохранение", exact: true })
        .click();
      await ui(title(page)).toHaveCount(0);
      expect(creates).toHaveLength(2);
      expect(creates[1]).toEqual(creates[0]);
      expect(uploads).toHaveLength(4);
      expect(publicUploads).toBe(0);
      expect(unboundReads).toBe(0);
      const sections = creates[0].sections as {
        type: string;
        url?: string;
        urls?: string[];
      }[];
      expect(
        sections.flatMap(
          (block) => block.urls ?? (block.url ? [block.url] : []),
        ),
      ).toEqual([...receipts.values()].map((value) => value.url));
      expect(
        uploads.filter((input) => input.usage === "articlePhoto"),
      ).toHaveLength(3);
      expect(
        uploads.filter((input) => input.usage === "articleDocument"),
      ).toHaveLength(1);
    } finally {
      await page.context().close();
    }
  },
  180000,
);

native(
  "article edit preserves existing URLs and refuses to replay an unknown update after reload",
  async () => {
    const page = await ownPage();
    try {
      const old = `${app.origin}/own-old.png`;
      const item = {
        id: 7,
        title: "EXISTING_PRIVATE_ARTICLE",
        coverUrl: null,
        access: "club",
        published: true,
        sections: [{ type: "photo", url: old }] as unknown[],
      };
      const uploads: Record<string, unknown>[] = [],
        updates: Record<string, unknown>[] = [];
      let response: ReturnType<typeof asset>,
        creates = 0;
      await page.route("**/own-old.png", (route) =>
        route.fulfill({ contentType: "image/png", body: png }),
      );
      await editorApi(page, (name, input) => {
        if (name === "admin.articles") return ok([item]);
        if (name === "admin.uploadPrivateContentFile") {
          uploads.push(input);
          response = asset(input, 1);
          return failure(503);
        }
        if (name === "admin.privateContentFileStatus") return ok(response);
        if (name === "admin.updateArticle") {
          updates.push(input);
          item.sections = input.sections as unknown[];
          return failure(503);
        }
        if (name === "admin.createArticle") creates++;
      });
      await open(page);
      await page.getByRole("button", { name: "Править", exact: true }).click();
      await page
        .getByRole("button", { name: "Фото", exact: true })
        .first()
        .click();
      await choose(page, "Выбрать фото", "edit.png");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await ui(
        page.getByRole("button", { name: "Проверить сохранение", exact: true }),
      ).toBeEnabled();
      await open(page);
      await page
        .getByRole("button", {
          name: "Восстановить изменение статьи",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Повторить сохранение", exact: true })
        .click();
      await ui(
        page.getByRole("button", {
          name: "Проверил список — удалить локальную копию",
          exact: true,
        }),
      ).toBeVisible();
      expect(updates).toHaveLength(1);
      expect(uploads).toHaveLength(1);
      expect(
        (updates[0].sections as { url: string }[]).map((block) => block.url),
      ).toEqual([old, response!.url]);
      await open(page);
      await page
        .getByRole("button", {
          name: "Восстановить изменение статьи",
          exact: true,
        })
        .click();
      await ui(
        page.getByRole("button", { name: "Повторить сохранение", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Проверить сохранение", exact: true })
        .click();
      expect(updates).toHaveLength(1);
      expect(creates).toBe(0);
      await page
        .getByRole("button", {
          name: "Проверил список — удалить локальную копию",
          exact: true,
        })
        .click();
      await ui(title(page)).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  },
  180000,
);

for (const stage of ["upload", "status"] as const) {
  native(
    `article account switch during ${stage} revokes previews, ignores late receipts and restores the owner's bytes`,
    async () => {
      const page = await ownPage();
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        let owner = 101,
          completed = 0,
          writes = 0;
        const uploads: Record<string, unknown>[] = [],
          statuses: { owner: number; input: Record<string, unknown> }[] = [];
        await editorApi(page, async (name, input) => {
          if (name === "admin.uploadPrivateContentFile") {
            uploads.push(input);
            if (stage === "status") return failure(503);
            await held;
            completed++;
            return ok(asset(input, 1));
          }
          if (name === "admin.privateContentFileStatus") {
            statuses.push({ owner, input });
            if (statuses.length === 1 && stage === "status") {
              await held;
              completed++;
            }
            return ok(asset(uploads[0], 1));
          }
          if (
            name === "admin.createArticle" ||
            name === "admin.updateArticle"
          ) {
            writes++;
            return ok(42);
          }
          if (name === "admin.articleCreationStatus")
            return ok({ status: "notRecorded" });
        });
        await open(page);
        await page.route("**/api/auth/me", (route) =>
          route.fulfill({
            json: {
              user: {
                id: owner,
                openId: `test-${owner}`,
                role: "admin",
                name: "Synthetic",
                email: "synthetic@example.test",
                lastSignedIn: "2026-10-16T10:00:00Z",
              },
            },
          }),
        );
        await page
          .getByRole("button", { name: "Написать статью", exact: true })
          .click();
        await title(page).fill("OWNER_PRIVATE_ARTICLE");
        await page
          .getByRole("button", { name: "Фото", exact: true })
          .first()
          .click();
        await choose(page, "Выбрать фото", "owner.png");
        const blob = await page
          .locator('img[src^="blob:"]')
          .getAttribute("src");
        await page
          .getByRole("button", { name: "Опубликовать", exact: true })
          .click();
        await ui.poll(() => uploads.length).toBe(1);
        if (stage === "status") {
          await page
            .getByRole("button", { name: "Проверить сохранение", exact: true })
            .click();
          await ui.poll(() => statuses.length).toBe(1);
        }
        owner = 202;
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await ui(title(page)).toHaveCount(0);
        await page.getByRole("button", { name: "Статьи", exact: true }).click();
        await page
          .getByRole("button", { name: "Написать статью", exact: true })
          .click();
        await ui(title(page)).toHaveValue("");
        await ui(page.locator('img[src^="blob:"]')).toHaveCount(0);
        expect(
          await page.evaluate(async (url) => {
            try {
              await fetch(url!);
              return "readable";
            } catch {
              return "revoked";
            }
          }, blob),
        ).toBe("revoked");
        release();
        await ui.poll(() => completed).toBe(1);
        await ui(title(page)).toHaveValue("");
        expect(writes).toBe(0);
        owner = 101;
        await open(page);
        await page
          .getByRole("button", {
            name: "Восстановить создание статьи",
            exact: true,
          })
          .click();
        await ui(title(page)).toHaveValue("OWNER_PRIVATE_ARTICLE");
        await ui(page.locator('img[src^="blob:"]')).toHaveCount(1);
        await page
          .getByRole("button", { name: "Повторить сохранение", exact: true })
          .click();
        await ui(title(page)).toHaveCount(0);
        expect(uploads).toHaveLength(1);
        expect(writes).toBe(1);
        expect(
          statuses.every(
            (item) =>
              item.owner === 101 &&
              item.input.idempotencyKey === uploads[0].idempotencyKey,
          ),
        ).toBe(true);
      } finally {
        release();
        await page.context().close();
      }
    },
    180000,
  );
}

native(
  "removing an article photo block revokes its blob and never uploads the removed file",
  async () => {
    const page = await ownPage();
    try {
      let uploads = 0;
      await editorApi(page, (name) => {
        if (/admin\.upload/.test(name)) uploads++;
      });
      await open(page);
      await page
        .getByRole("button", { name: "Написать статью", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Фото", exact: true })
        .first()
        .click();
      await choose(page, "Выбрать фото", "removed.png");
      const blob = await page.locator('img[src^="blob:"]').getAttribute("src");
      await page
        .getByRole("button", { name: "Удалить блок 2", exact: true })
        .click();
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(0);
      expect(
        await page.evaluate(async (url) => {
          try {
            await fetch(url!);
            return "readable";
          } catch {
            return "revoked";
          }
        }, blob),
      ).toBe("revoked");
      expect(uploads).toBe(0);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
