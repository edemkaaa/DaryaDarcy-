import { expect, test, type Page } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { failure, ok } from "./editor-fixtures";
import { CAROUSEL_IMAGES } from "../src/features/library/about-screen.content";
import { validateReadResponse } from "../src/shared/api/read-response-contracts";

test.use({ hasTouch: true, isMobile: true });
const urls = CAROUSEL_IMAGES.slice(0, 6).map(
  (_, index) => `https://f10-preview.example.test/${index}.webp`,
);

/** Готовые варианты 320px достаточны для плитки и не декодируют многомегапиксельные оригиналы в тестах. */
async function images(page: Page) {
  const directory = resolve(
    dirname(test.info().file),
    "../public/assets/responsive",
  );
  const files = await readdir(directory);
  const previews = CAROUSEL_IMAGES.slice(0, 6).map((uri) => {
    const stem = basename(uri).split(".full.")[0];
    const preview = files.find((file) => file.startsWith(`${stem}.w320.`));
    if (!preview) throw new Error(`Missing test thumbnail: ${stem}`);
    return resolve(directory, preview);
  });
  await page.route("https://f10-preview.example.test/**", async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (name === "broken.webp") return route.fulfill({ status: 404, body: "" });
    const index = Number(name.split(".")[0]);
    if (!Number.isInteger(index) || index < 0 || index >= urls.length)
      return route.abort();
    await route.fulfill({
      contentType: "image/webp",
      body: await readFile(previews[index]),
    });
  });
}

/** Снимок после загрузки шрифтов/картинок не фиксирует промежуточный кадр анимации. */
async function screenshot(page: Page, name: string) {
  if (!process.env.F10_F17_SCREENSHOTS) return;
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator("img:visible")
    .evaluateAll((nodes) =>
      Promise.all(
        nodes.map((node) =>
          (node as HTMLImageElement).decode().catch(() => undefined),
        ),
      ),
    );
  await page.screenshot({
    path: `${process.env.F10_F17_SCREENSHOTS}/${name}.png`,
    animations: "disabled",
  });
}

function video(postId: number, posterUrl: string | null) {
  return {
    id: 100 + postId,
    type: "video",
    url: `/api/media/post-attachments/${100 + postId}`,
    duration: 12,
    filename: "video.mp4",
    mimeType: "video/mp4",
    posterUrl,
    fileSize: 1024,
    postId,
    sortOrder: 0,
    createdAt: "2026-11-01T12:00:00Z",
  };
}

/** Та же демонстрационная сетка, которую владелец одобрил на скриншотах. */
async function feed(page: Page, edgeCases = false) {
  await images(page);
  const posts = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    text:
      index === 0
        ? "Видео с готовой обложкой"
        : index === 2
          ? "Видео без обложки"
          : `Фотография ${index + 1}`,
    photos: index === 0 || index === 2 ? [] : [urls[index]],
    media:
      index === 0 || index === 2
        ? [video(index + 1, index === 0 ? urls[0] : null)]
        : [],
    tags: index === 0 || index === 2 ? ["video"] : [],
    target: "feed",
    likeCount: 0,
    commentCount: 0,
    richText: null,
    createdAt: "2026-11-01T12:00:00Z",
    publishedAt: "2026-11-01T12:00:00Z",
  }));
  if (edgeCases) {
    posts[1].media = [video(2, urls[0])];
    posts[3].photos = ["https://f10-preview.example.test/legacy.mp4", urls[3]];
    posts[4].photos = [];
    posts[4].media = [video(5, "https://f10-preview.example.test/broken.webp")];
  }
  const response = { posts, nextCursor: null };
  validateReadResponse("feed.listPaginated", response, undefined);
  await layoutApi(page, false, (name) =>
    name === "feed.listPaginated" ? ok(response) : undefined,
  );
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Показать сеткой", exact: true })
    .click();
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 400 },
]) {
  test(`F10: video poster fills its existing grid tile at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await feed(page);
    const tile = page.getByRole("link", {
      name: "Открыть публикацию: Видео с готовой обложкой",
      exact: true,
    });
    await expect(tile.locator("img")).toHaveAttribute("src", urls[0]);
    await expect
      .poll(() =>
        tile
          .locator("img")
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(
      page
        .getByRole("link", {
          name: "Открыть публикацию: Видео без обложки",
          exact: true,
        })
        .locator("img"),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("link", {
          name: "Открыть публикацию: Фотография 2",
          exact: true,
        })
        .locator("img"),
    ).toHaveAttribute("src", urls[1]);
    await expect(tile).toHaveAttribute("href", "/post/1");
    await expect(
      page.getByRole("navigation", { name: "Разделы", exact: true }),
    ).toBeInViewport();
    const box = (await tile.boundingBox())!;
    expect(Math.abs(box.height / box.width - 1.25)).toBeLessThan(0.02);
    await screenshot(page, `F10-after-${viewport.width}`);
  });
}

test("F10: mixed media, legacy video URLs and failed poster keep safe tile behavior", async ({
  page,
}) => {
  await feed(page, true);
  await expect(
    page
      .getByRole("link", {
        name: "Открыть публикацию: Фотография 2",
        exact: true,
      })
      .locator("img"),
  ).toHaveAttribute("src", urls[1]);
  await expect(
    page
      .getByRole("link", {
        name: "Открыть публикацию: Фотография 4",
        exact: true,
      })
      .locator("img"),
  ).toHaveAttribute("src", urls[3]);
  await expect(
    page.locator('[class*="gridImage"] img[src$=".mp4"]'),
  ).toHaveCount(0);
  const broken = page.getByRole("link", {
    name: "Открыть публикацию: Фотография 5",
    exact: true,
  });
  const before = await broken.boundingBox();
  await expect(
    broken.getByRole("img", { name: "Изображение недоступно", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(await broken.boundingBox()).toEqual(before);
  await expect(broken).toHaveAttribute("href", "/post/5");
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 400 },
]) {
  test(`F17: only a confirmed empty result shows the empty message at ${viewport.width}px`, async ({
    page,
  }) => {
    test.skip(
      process.env.VK_CATALOG_UI_ENABLED !== "true",
      "VK catalog build only",
    );
    await page.setViewportSize(viewport);
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    await layoutApi(page, false, (name) =>
      name === "videos.catalog"
        ? ok({ items: [], nextCursor: null })
        : undefined,
    );
    await page.route("**/api/trpc/**", async (route) => {
      if (new URL(route.request().url()).pathname.includes("videos.catalog")) {
        await gate;
      }
      await route.fallback();
    });
    try {
      await gotoWithSession(page, "/videos");
      await expect(
        page.locator('[data-content-placeholder="video"]'),
      ).toBeVisible();
      await expect(
        page.getByText("Видео пока нет", { exact: true }),
      ).toHaveCount(0);
      const nav = page.getByRole("navigation", {
        name: "Разделы",
        exact: true,
      });
      const before = await nav.boundingBox();
      release();
      await expect(
        page.getByText("Видео пока нет", { exact: true }),
      ).toBeInViewport();
      await expect(page.locator("[data-content-placeholder]")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Повторить", exact: true }),
      ).toHaveCount(0);
      await expect(nav).toBeInViewport();
      expect(await nav.boundingBox()).toEqual(before);
      await screenshot(page, `F17-after-${viewport.width}`);
    } finally {
      release();
    }
  });
}

test("F17: request error remains retryable and is distinct from an empty catalog", async ({
  page,
}) => {
  test.skip(
    process.env.VK_CATALOG_UI_ENABLED !== "true",
    "VK catalog build only",
  );
  await images(page);
  let mode: "error" | "cards" | "empty" = "error";
  await layoutApi(page, false, (name) => {
    if (name !== "videos.catalog") return undefined;
    if (mode === "error") return failure(503);
    return ok({
      items:
        mode === "empty"
          ? []
          : [
              {
                id: 42,
                title: "Видео для проверки",
                duration: null,
                access: "public",
                canWatch: true,
                thumbnailUrl: urls[0],
              },
            ],
      nextCursor: null,
    });
  });
  await gotoWithSession(page, "/videos");
  await expect(
    page.getByText("Не удалось загрузить видео", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Видео пока нет", { exact: true })).toHaveCount(
    0,
  );
  mode = "cards";
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Открыть видео: Видео для проверки",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Видео пока нет", { exact: true })).toHaveCount(
    0,
  );
  mode = "empty";
  await gotoWithSession(page, "/videos");
  await expect(page.getByText("Видео пока нет", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Открыть видео: Видео для проверки",
      exact: true,
    }),
  ).toHaveCount(0);
});
