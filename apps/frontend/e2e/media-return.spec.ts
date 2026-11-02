import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok } from "./editor-fixtures";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#d8c7ac"/></svg>';
const post = (id: number) => ({
  id,
  text: `Публикация ${id}`,
  photos: [`https://return.example.test/photo-${id}.svg`],
  richText: null,
  tags: [],
  media: [],
  target: "feed",
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-01T12:00:00Z",
  publishedAt: "2026-10-01T12:00:00Z",
});

async function api(page: Page) {
  const state = { revision: 1, denied: false, metadataReads: 0 };
  await layoutApi(page, true, (name) => {
    if (name === "feed.listPaginated" || name === "club.listByCategory")
      return ok({
        posts: Array.from({ length: 12 }, (_, index) => ({
          ...post(index + 1),
          target: name === "club.listByCategory" ? "club" : "feed",
        })),
        nextCursor: null,
      });
    if (name === "videos.list")
      return ok(
        Array.from({ length: 5 }, (_, index) => ({
          id: index + 1,
          youtubeId: "fixture",
          title: `Видео ${index + 1}`,
          thumbnailUrl: `https://return.example.test/video-${index + 1}.svg`,
          published: true,
          duration: null,
          views: null,
          publishedText: null,
          videoUrl: null,
        })),
      );
    if (name === "videos.catalog")
      return ok({
        items: Array.from({ length: 5 }, (_, index) => ({
          id: index + 1,
          title: `Видео ${index + 1}`,
          duration: null,
          access: "public",
          canWatch: true,
          thumbnailUrl: `https://return.example.test/video-${index + 1}.svg`,
        })),
        nextCursor: null,
      });
  });
  await page.route("https://return.example.test/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.route("**/api/library/materials/patterns/files", async (route) => {
    state.metadataReads++;
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (state.denied)
      return route.fulfill({
        status: 404,
        json: { error: "Материал недоступен" },
      });
    return route.fulfill({
      json: {
        files: ["holly", "sock", "star", "apple", "loshadka"].map(
          (fileKey, sortOrder) => ({
            fileKey,
            sortOrder,
            revision: state.revision,
            filename: "fixture",
            mimeType: fileKey === "loshadka" ? "application/pdf" : "image/png",
            fileSize: 100,
            url: `/api/media/library-files/patterns/${fileKey}`,
          }),
        ),
        nextCursor: null,
      },
    });
  });
  await page.route("**/api/media/library-files/patterns/*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      headers: { "Cache-Control": "private, no-store" },
      body: svg,
    }),
  );
  return state;
}

for (const width of [390, 1440]) {
  test(`about page retains its photos on back/reopen at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await api(page);
    await gotoWithSession(page, "/library");
    const open = () =>
      page
        .getByRole("button", { name: "Открыть материал: Обо мне", exact: true })
        .click();
    await open();
    const image = page
      .locator(
        '[data-tab-screen="/library/about-me"] button[aria-label="Открыть фото 1"] img',
      )
      .first();
    await expect(image).toBeVisible();
    await image.evaluate((image) => (image as HTMLImageElement).decode());
    const original = (await image.elementHandle())!;
    await page.goBack();
    await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
    await open();
    await expect(image).toBeVisible();
    expect(await original.evaluate((image) => image.isConnected)).toBe(true);
  });

  test(`patterns keep decoded images and scroll on back/reopen at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await api(page);
    let images = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/media/library-files/patterns/"))
        images++;
    });
    await gotoWithSession(page, "/library");
    const open = () =>
      page
        .getByRole("button", {
          name: "Открыть материал: Зимние выкройки'26",
          exact: true,
        })
        .click();
    await open();
    const photo = page.locator(
      'img[src="/api/media/library-files/patterns/holly"]',
    );
    await expect(photo).toBeVisible();
    await photo.evaluate((image) => (image as HTMLImageElement).decode());
    const original = (await photo.elementHandle())!;
    const scroll = (await page
      .locator("main .ui-scroll:visible")
      .first()
      .elementHandle())!;
    const top = await scroll.evaluate((element) => {
      element.scrollTop = 180;
      return element.scrollTop;
    });
    const before = images;
    await page.goBack();
    await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
    await open();
    await expect(photo).toBeVisible();
    expect(await original.evaluate((image) => image.isConnected)).toBe(true);
    expect(await scroll.evaluate((element) => element.scrollTop)).toBe(top);
    expect(images).toBe(before);
  });

  for (const path of ["feed", "club", "videos"]) {
    test(`${path} keeps the visible image nodes while its tab is hidden at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await api(page);
      await gotoWithSession(page, `/${path}`);
      const image = page
        .locator('main img[src^="https://return.example.test/"]')
        .first();
      await expect(image).toBeVisible();
      await image.evaluate((element) => (element as HTMLImageElement).decode());
      const original = (await image.elementHandle())!;
      if (path === "club")
        await page
          .getByRole("link", { name: "На главную", exact: true })
          .click();
      await page.locator('nav a[href="/library"]').click();
      await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
      // Let the hidden tab's IntersectionObserver deliver its exit entries.
      await page.waitForTimeout(150);
      expect(await original.evaluate((element) => element.isConnected)).toBe(
        true,
      );
      await page.locator(`nav a[href="/${path}"]`).click();
      await expect(image).toBeVisible();
      expect(await original.evaluate((element) => element.isConnected)).toBe(
        true,
      );
      expect(
        await original.evaluate(
          (element) => (element as HTMLImageElement).complete,
        ),
      ).toBe(true);
    });
  }
}

test("pattern revalidation retains unchanged images, replaces a new revision, and hides denied files", async ({
  page,
}) => {
  await page.clock.install();
  const state = await api(page);
  await gotoWithSession(page, "/library/patterns");
  const photo = page.locator(
    'img[src="/api/media/library-files/patterns/holly"]',
  );
  await expect(photo).toBeVisible();
  await photo.evaluate((image) => (image as HTMLImageElement).decode());
  const original = (await photo.elementHandle())!;
  const before = state.metadataReads;
  const checked = page.waitForResponse((response) =>
    response.url().endsWith("/api/library/materials/patterns/files"),
  );
  await page.clock.fastForward(61_000);
  await expect.poll(() => state.metadataReads).toBe(before + 1);
  // Metadata is deliberately slow. The old image stays during the check.
  expect(await original.evaluate((image) => image.isConnected)).toBe(true);
  await checked;
  expect(await original.evaluate((image) => image.isConnected)).toBe(true);
  state.revision++;
  await page.clock.fastForward(61_000);
  await expect
    .poll(() => original.evaluate((image) => image.isConnected))
    .toBe(false);
  await expect(photo).toBeVisible();
  state.denied = true;
  await page.clock.fastForward(61_000);
  await expect(photo).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Открыть PDF →", exact: true }),
  ).toBeEnabled(); // The horse PDF is explicitly free, unlike the four patterns.
});

test("retained pattern images are removed across all panels when the session ends", async ({
  page,
}) => {
  await api(page);
  await gotoWithSession(page, "/library/patterns");
  await expect(
    page.locator('img[src="/api/media/library-files/patterns/holly"]'),
  ).toBeVisible();
  await page.locator('nav a[href="/library"]').click();
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: null } }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "logout",
      }),
    ),
  );
  await expect(
    page.locator('img[src^="/api/media/library-files/"]'),
  ).toHaveCount(0);
});

test("long feeds still release distant rows and never replay a displayed photo's fade", async ({
  page,
}) => {
  await api(page);
  await gotoWithSession(page, "/feed");
  const photo = page.locator(
    'img[src="https://return.example.test/photo-1.svg"]',
  );
  await expect(photo).toBeVisible();
  await photo.evaluate((image) => (image as HTMLImageElement).decode());
  const original = (await photo.elementHandle())!;
  const rows = page.locator("[data-windowed-collection] [data-item-index]");
  await rows.last().scrollIntoViewIfNeeded();
  await expect
    .poll(() => original.evaluate((image) => image.isConnected))
    .toBe(false);
  await rows.first().scrollIntoViewIfNeeded();
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("decoding", "sync");
  expect(
    await photo.evaluate((image) => getComputedStyle(image).transitionDuration),
  ).toBe("0s");
});

test("a hidden pattern page cancels a late initial read and starts cleanly on return", async ({
  page,
}) => {
  await api(page);
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/library/materials/patterns/files", async (route) => {
    reads++;
    if (reads === 1) {
      await gate;
      return route
        .fulfill({ json: { files: [], nextCursor: null } })
        .catch(() => {});
    }
    return route.fallback();
  });
  try {
    await gotoWithSession(page, "/library/patterns");
    await expect.poll(() => reads).toBe(1);
    await page.locator('nav a[href="/library"]').click();
    await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
    release();
    await page.waitForTimeout(150);
    await expect(
      page.locator('img[src^="/api/media/library-files/"]'),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Открыть материал: Зимние выкройки'26",
        exact: true,
      })
      .click();
    await expect(
      page.locator('img[src="/api/media/library-files/patterns/holly"]'),
    ).toBeVisible();
    expect(reads).toBeGreaterThan(1);
  } finally {
    release();
  }
});

test("the aesthetic guide keeps its confirmed body on return, stops hidden reads and removes denied content", async ({
  page,
}) => {
  await page.clock.install();
  await api(page);
  let reads = 0;
  let denied = false;
  const fields = (keys: string[]) =>
    Object.fromEntries(keys.map((key) => [key, ""]));
  await page.route("**/api/library/guides/aesthetics/*", async (route) => {
    reads++;
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (denied)
      return route.fulfill({
        status: 404,
        json: { error: "Материал недоступен" },
      });
    const key = new URL(route.request().url()).pathname.split("/").at(-1);
    return route.fulfill({
      json: {
        key,
        style: {
          ...fields([
            "contrast",
            "details",
            "accessories",
            "shoes",
            "fabrics",
            "colors",
            "bonus",
            "principle",
            "mixing",
          ]),
          intro: `Приватный текст ${key}`,
          table: { romantic: [], workwear: [] },
        },
        space: fields([
          "intro",
          "finishing",
          "wallpaperBrands",
          "ceilings",
          "importantNote",
          "palette",
          "lifehack",
          "furniture",
          "furnitureWhere",
          "furnitureAvoid",
          "textile",
          "textileFormula",
          "details",
          "lighting",
        ]),
        rituals: { items: [] },
        blog: { intro: "", strength: "", rubrics: [], tips: [] },
        inspiration: {
          films: [],
          series: [],
          books: [],
          music: [],
          blogs: { instagram: [], youtube: [] },
          magazines: [],
        },
      },
    });
  });
  await gotoWithSession(page, "/library");
  const open = () =>
    page
      .getByRole("button", {
        name: "Открыть материал: Гид по эстетикам",
        exact: true,
      })
      .click();
  await open();
  const text = page.getByText("Приватный текст cottagecore", { exact: true });
  await expect(text).toHaveCount(1);
  const original = (await text.elementHandle())!;
  await page.goBack();
  await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
  const before = reads;
  await page.clock.fastForward(120_000);
  expect(reads).toBe(before);
  await open();
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  await expect(text).toHaveCount(1);
  await expect.poll(() => reads).toBeGreaterThan(before);
  denied = true;
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await page.clock.runFor(100);
  await expect(text).toHaveCount(0);
});
