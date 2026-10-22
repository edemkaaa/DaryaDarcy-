import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { failure, ok } from "./editor-fixtures";

async function advance(page: Page, milliseconds = 61_000) {
  await page.clock.fastForward(milliseconds);
  // Flush the tRPC batch timer created by the periodic query.
  await page.clock.runFor(100);
}

async function navigate(page: Page, path: string) {
  await page.evaluate((path) => {
    const next = (
      window as Window & {
        next?: { router: { push(path: string): void } };
      }
    ).next;
    if (!next) throw new Error("Client router unavailable");
    next.router.push(path);
  }, path);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

const post = (id: number, version: string) => ({
  id,
  text: `${version}. ${"Длинная публикация для проверки прокрутки. ".repeat(10)}`,
  richText: null,
  tags: [],
  photos: [],
  media: [],
  target: "feed",
  likeCount: 0,
  commentCount: 0,
  publishedAt: "2026-10-01T12:00:00Z",
  createdAt: "2026-10-01T12:00:00Z",
});

for (const width of [390, 1440]) {
  test(`external feed changes arrive after a minute without remounting at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    let rows = Array.from({ length: 12 }, (_, index) =>
      post(index + 1, `Версия А ${index + 1}`),
    );
    let reads = 0;
    await layoutApi(page, false, (name) => {
      if (name === "feed.listPaginated") {
        reads++;
        return ok({ posts: rows, nextCursor: null });
      }
    });
    await gotoWithSession(page, "/feed");
    await expect(page.getByText(/^Версия А 1\./).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const scroll = (await page
      .locator("main .ui-scroll:not(.ui-scroll-horizontal)")
      .first()
      .elementHandle())!;
    const top = await scroll.evaluate((element) => {
      element.scrollTop = 300;
      return element.scrollTop;
    });
    const origin = await page.evaluate(() => performance.timeOrigin);
    const before = reads;
    // Simulate another admin/browser changing the server response. No local
    // mutation or query invalidation informs this visitor's QueryClient.
    rows = rows.map((row) => post(row.id, `Версия Б ${row.id}`));
    await advance(page, 45_000);
    expect(reads).toBe(before);
    await expect(page.getByText(/^Версия А 1\./)).toHaveCount(1);
    await advance(page, 16_000);
    await expect.poll(() => reads).toBe(before + 1);
    await expect(page.getByText(/^Версия Б 1\./)).toHaveCount(1);
    expect(await scroll.evaluate((element) => element.isConnected)).toBe(true);
    expect(await scroll.evaluate((element) => element.scrollTop)).toBe(top);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
    rows = [post(99, "Новая публикация"), ...rows.slice(1)];
    await advance(page);
    await expect(page.getByText(/^Версия Б 1\./)).toHaveCount(0);
    await expect(page.getByText(/^Новая публикация\./)).toHaveCount(1);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
  });
}

test("polls only the visible section, pauses while hidden/offline and resumes stale data", async ({
  page,
}) => {
  await page.clock.install();
  let feedReads = 0;
  let libraryReads = 0;
  let title = "Старая статья";
  await layoutApi(page, false, (name) => {
    if (name === "feed.listPaginated") {
      feedReads++;
      return ok({ posts: [post(1, "Лента")], nextCursor: null });
    }
    if (name === "articles.list") {
      libraryReads++;
      return ok([{ id: 700, title, coverUrl: null, access: "public" }]);
    }
  });
  await gotoWithSession(page, "/feed");
  await expect(page.getByText(/^Лента\./)).toBeVisible();
  await navigate(page, "/library");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  const beforeFeed = feedReads;
  const beforeLibrary = libraryReads;
  await advance(page);
  await expect.poll(() => libraryReads).toBe(beforeLibrary + 1);
  expect(feedReads).toBe(beforeFeed);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  const beforeHidden = libraryReads;
  title = "Обновлённая статья";
  await advance(page, 120_000);
  expect(libraryReads).toBe(beforeHidden);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  await page.clock.runFor(100);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  const beforeOffline = libraryReads;
  await advance(page, 120_000);
  expect(libraryReads).toBe(beforeOffline);
  title = "Статья после восстановления сети";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.clock.runFor(100);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  expect(feedReads).toBe(beforeFeed);
});

test("club refresh preserves the selected section and sees another admin's edits", async ({
  page,
}) => {
  await page.clock.install();
  let title = "Клуб до изменения";
  let reads = 0;
  await layoutApi(page, true, (name) => {
    if (name === "club.list") {
      reads++;
      return ok({
        posts: [{ ...post(700, title), tags: ["life"], target: "club" }],
        nextCursor: null,
      });
    }
  });
  await gotoWithSession(page, "/club");
  const tab = page
    .getByRole("navigation", { name: "Разделы клуба", exact: true })
    .getByRole("button", { name: "Лайф", exact: true });
  await tab.click();
  await expect(page.getByText(/Клуб до изменения/).first()).toBeVisible();
  const before = reads;
  title = "Клуб после изменения";
  await advance(page);
  await expect.poll(() => reads).toBe(before + 1);
  await expect(page.getByText(/Клуб после изменения/).first()).toBeVisible();
  await expect(tab).toHaveAttribute("aria-pressed", "true");
  await navigate(page, "/shop");
  const afterExit = reads;
  await advance(page, 120_000);
  expect(reads).toBe(afterExit);
});

for (const width of [390, 1440]) {
  test(`club background refresh keeps content still while pending and after completion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    let version = "А";
    let requests = 0;
    let pending: Promise<void> | undefined;
    await layoutApi(page, true, (name) => {
      if (name === "club.list")
        return ok({
          posts: Array.from({ length: 12 }, (_, index) => ({
            ...post(index + 1, `Клуб версия ${version} ${index + 1}`),
            target: "club",
          })),
          nextCursor: null,
        });
    });
    await page.route("**/api/trpc/**", async (route) => {
      const names = decodeURIComponent(new URL(route.request().url()).pathname)
        .split("/api/trpc/")[1]
        .split(",");
      if (names.includes("club.list")) {
        requests++;
        if (pending) await pending;
      }
      await route.fallback();
    });
    await gotoWithSession(page, "/club");
    await expect(page.getByText(/^Клуб версия А 1\./).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const list = page.locator(
      '[data-tab-screen="/club"] [data-windowed-collection]',
    );
    const geometry = () =>
      list.evaluate((node) => ({
        scrollTop: node.scrollTop,
        contentTop: node
          .querySelector(":scope > .ui-scroll-content")!
          .getBoundingClientRect().top,
        firstPostTop: node
          .querySelector('[data-item-index="0"]')!
          .getBoundingClientRect().top,
      }));
    for (const scrollTop of [0, 300]) {
      await list.evaluate((node, top) => {
        node.scrollTop = top;
      }, scrollTop);
      await page.clock.runFor(250);
      const before = await geometry();
      const previousRequests = requests;
      let release!: () => void;
      pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        await advance(page);
        await expect.poll(() => requests).toBe(previousRequests + 1);
        await page.clock.runFor(100);
        expect(await geometry()).toEqual(before);
        await expect(list.locator(":scope > .ui-refresh")).toHaveCount(0);
        version = version === "А" ? "Б" : "В";
      } finally {
        pending = undefined;
        release();
      }
      await expect(
        page.getByText(new RegExp(`^Клуб версия ${version} 1\\.`)).first(),
      ).toBeVisible();
      expect(await geometry()).toEqual(before);
    }
  });
}

for (const route of ["article", "post", "video"] as const) {
  test(`${route} keeps cached reading content during a failed refresh, then reflects edits and deletion`, async ({
    page,
  }) => {
    await page.clock.install();
    let mode: "initial" | "unavailable" | "edited" | "deleted" = "initial";
    let reads = 0;
    const procedure = {
      article: "articles.getById",
      post: "feed.getById",
      video: "videos.getById",
    }[route];
    await layoutApi(page, false, (name) => {
      if (name !== procedure) return;
      reads++;
      if (mode === "unavailable") return failure(503);
      if (mode === "deleted") return ok(null);
      const title =
        mode === "edited" ? "Обновлённый материал" : "Первоначальный материал";
      if (route === "post") return ok(post(700, title));
      if (route === "video")
        return ok({
          id: 700,
          title,
          youtubeId: "test-video-id",
          videoUrl: null,
        });
      return ok({
        id: 700,
        title,
        coverUrl: null,
        access: "public",
        locked: false,
        sections: [{ type: "text", text: "Содержимое статьи" }],
      });
    });
    const path = {
      article: "/library/article/700",
      post: "/post/700",
      video: "/video/700",
    }[route];
    await gotoWithSession(page, path);
    const initial = page.getByText(/Первоначальный материал/).first();
    await expect(initial).toBeVisible();
    const container = (await initial.elementHandle())!;
    const origin = await page.evaluate(() => performance.timeOrigin);
    const before = reads;
    mode = "unavailable";
    await advance(page);
    await expect.poll(() => reads).toBeGreaterThan(before);
    await advance(page, 3_000); // allow the one permitted temporary-error retry
    await expect(initial).toBeVisible();
    expect(await container.evaluate((element) => element.isConnected)).toBe(
      true,
    );
    mode = "edited";
    await advance(page);
    await expect(page.getByText(/Обновлённый материал/).first()).toBeVisible();
    mode = "deleted";
    await advance(page);
    await expect(page.getByText(/Обновлённый материал/)).toHaveCount(0);
    await expect(
      page.getByText(
        {
          article: "Статья не найдена",
          post: "Пост не найден",
          video: "Видео не найдено",
        }[route],
        { exact: true },
      ),
    ).toBeVisible();
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
  });
}

test("an article switched to club access hides its cached sections after polling", async ({
  page,
}) => {
  await page.clock.install();
  let locked = false;
  await layoutApi(page, false, (name) => {
    if (name === "articles.getById")
      return ok({
        id: 700,
        title: "Статья",
        access: locked ? "club" : "public",
        locked,
        sections: locked
          ? []
          : [{ type: "text", text: "Прежде открытый текст" }],
      });
  });
  await gotoWithSession(page, "/library/article/700");
  await expect(
    page.getByText("Прежде открытый текст", { exact: true }),
  ).toBeVisible();
  locked = true;
  await advance(page);
  await expect(
    page.getByText("Прежде открытый текст", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Эта статья для участниц клуба Darcy.", { exact: true }),
  ).toBeVisible();
});
