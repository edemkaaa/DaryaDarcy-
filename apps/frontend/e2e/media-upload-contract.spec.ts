import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { randomFillSync } from "node:crypto";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
async function setup(page: Page, uploads: Record<string, unknown>[]) {
  await editorApi(page, (name, input) => {
    if (name === "admin.uploadPhoto") {
      uploads.push(input);
      return ok({ url: "https://example.test/photo.webp" });
    }
  });
  await page.route("https://s3.twcstorage.ru/**", (route) => route.abort());
  await page.route("https://example.test/**", (route) => route.abort());
}
async function open(page: Page) {
  await gotoWithSession(page, "/feed");
  await page.getByRole("button", { name: "Новый пост", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Редактор публикации" }),
  ).toBeVisible();
}
const largePng = () =>
  sharp(randomFillSync(Buffer.alloc(1100 * 1100 * 4)), {
    raw: { width: 1100, height: 1100, channels: 4 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();

test("an original photo above 4 MiB is prepared within the server limit", async ({
  page,
}) => {
  const uploads: Record<string, unknown>[] = [];
  await setup(page, uploads);
  await open(page);
  const bytes = await largePng();
  expect(bytes.length).toBeGreaterThan(MAX_PHOTO_BYTES);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать из галереи", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "large.png", mimeType: "image/png", buffer: bytes });
  await expect.poll(() => uploads.length).toBe(1);
  const prepared = Buffer.from(String(uploads[0].base64), "base64");
  expect(prepared.length).toBeLessThanOrEqual(MAX_PHOTO_BYTES);
  expect((await sharp(prepared).metadata()).format).toBe("jpeg");
});

test("transparent article PNG is resized/encoded within the limit with alpha preserved", async ({
  page,
}) => {
  const uploads: Record<string, unknown>[] = [];
  await setup(page, uploads);
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await page.getByRole("button", { name: "PNG", exact: true }).first().click();
  const bytes = await largePng();
  expect(bytes.length).toBeGreaterThan(MAX_PHOTO_BYTES);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать PNG без фона", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "transparent.png", mimeType: "image/png", buffer: bytes });
  await expect.poll(() => uploads.length).toBe(1);
  const prepared = Buffer.from(String(uploads[0].base64), "base64");
  expect(prepared.length).toBeLessThanOrEqual(MAX_PHOTO_BYTES);
  const metadata = await sharp(prepared).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.hasAlpha).toBe(true);
  expect((await sharp(prepared).stats()).channels[3].min).toBeLessThan(255);
});

for (const format of ["gif", "apng", "webp"] as const) {
  test(`animated ${format} is refused before upload`, async ({ page }) => {
    const uploads: Record<string, unknown>[] = [];
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    await setup(page, uploads);
    await open(page);
    let bytes: Buffer;
    let mime: string;
    if (format === "gif") {
      bytes = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64",
      );
      mime = "image/gif";
    } else if (format === "apng") {
      // APNG animation-control chunk follows the PNG signature.
      bytes = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        Buffer.from([0, 0, 0, 8]),
        Buffer.from("acTL"),
        Buffer.alloc(12),
      ]);
      mime = "image/png";
    } else {
      bytes = Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([20, 0, 0, 0]),
        Buffer.from("WEBPANIM"),
        Buffer.from([6, 0, 0, 0]),
        Buffer.alloc(6),
      ]);
      mime = "image/webp";
    }
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Выбрать из галереи", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({ name: `animated.${format}`, mimeType: mime, buffer: bytes });
    await expect
      .poll(() => messages)
      .toEqual([
        "Анимированные изображения не поддерживаются. Выберите обычное фото JPG, PNG или WebP.",
      ]);
    expect(uploads).toEqual([]);
  });
}

test("invalid raw video explains format refusal without recommending a blind retry", async ({
  page,
}) => {
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await setup(page, []);
  await page.route("**/api/admin/upload-video?*", (route) =>
    route.fulfill({ status: 400, json: { error: "Некорректный видеофайл" } }),
  );
  await open(page);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать видеофайл", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "invalid.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not a video"),
  });
  await expect.poll(() => messages).toEqual(["Некорректный видеофайл"]);
});
