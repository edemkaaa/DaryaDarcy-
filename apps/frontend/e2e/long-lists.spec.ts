import { test, expect, type Page } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";

test.setTimeout(60_000);
const list = (page: Page) =>
  page.locator(
    "main .ui-scroll:not(.ui-scroll-horizontal):visible:has(.ui-collection-item, .ui-collection-row)",
  );

async function longListApi(page: Page, path: string) {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await layoutApi(page, true);
  const posts = Array.from({ length: 48 }, (_, index) => ({
    id: index + 1,
    text: `LONG_POST_${index + 1} ${"Текст публикации разной высоты.\n".repeat(4 + (index % 7))}`,
    target: path === "/club" ? "club" : "feed",
    tags: ["Комьюнити"],
    photos: [`https://images.example.test/${index}.svg`],
    media: [],
    richText: null,
    likeCount: 0,
    commentCount: 1,
    createdAt: new Date(Date.UTC(2026, 9, 5) - index * 60_000).toISOString(),
    publishedAt: new Date(Date.UTC(2026, 9, 5) - index * 60_000).toISOString(),
  }));
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="beige"/></svg>',
    }),
  );
  await page.route("https://images.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#e4cfb4"/></svg>',
    }),
  );
  await page.route("**/api/trpc/**", (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    const inputs = JSON.parse(
      route.request().postData() ?? url.searchParams.get("input") ?? "{}",
    );
    const results = names.map((name, index) => {
      const input = inputs[index]?.json ?? {};
      let data: unknown = [];
      if (name === "club.subscription")
        data = {
          subscribed: true,
          expiresAt: null,
          cancelAtPeriodEnd: false,
          monthlyPrice: "790",
        };
      if (name === "feed.userInteractions")
        data = { likedIds: [], savedIds: [] };
      if (name === "club.list" || name === "feed.listPaginated") {
        const start = input.cursor ?? 0;
        const end = Math.min(start + (input.limit ?? 12), posts.length);
        data = {
          posts: posts.slice(start, end),
          nextCursor: end < posts.length ? end : null,
        };
      }
      if (name === "club.comments")
        data = [
          {
            id: input.postId * 100,
            postId: input.postId,
            userId: 101,
            parentId: null,
            text: "Комментарий участницы",
            photos: [],
            createdAt: "2026-10-05T10:00:00Z",
            authorName: "Участница",
            authorAvatarUrl: null,
            likeCount: 0,
            likedByMe: false,
          },
        ];
      return { result: { data: { json: data } } };
    });
    return route.fulfill({
      json: url.searchParams.get("batch") === "1" ? results : results[0],
    });
  });
}

async function loadAll(page: Page) {
  await expect
    .poll(async () => {
      await expect(list(page)).toHaveCount(1);
      const count = await list(page).locator(".ui-collection-item").count();
      if (count < 48)
        await list(page).evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
      return count;
    })
    .toBe(48);
}

for (const width of [390, 1440]) {
  test(`club retains a reply draft outside the viewport and restores keyboard focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await longListApi(page, "/club");
    await gotoWithSession(page, "/club");
    const first = list(page).locator(".ui-collection-item").first();
    await first.getByRole("button", { name: "Ответить", exact: true }).click();
    const draft = first.getByPlaceholder("Ваш ответ...");
    await draft.fill("Черновик ответа сохраняется при прокрутке");
    await list(page).focus();
    await loadAll(page);
    await list(page).evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(draft).not.toBeInViewport();
    await draft.focus();
    await expect(draft).toBeFocused();
    await expect(draft).toBeInViewport();
    await expect(draft).toHaveValue(
      "Черновик ответа сохраняется при прокрутке",
    );
    await expect(first.getByPlaceholder("Написать комментарий...")).toHaveCount(
      0,
    );
    await page.setViewportSize({
      width: width === 390 ? 480 : 390,
      height: 844,
    });
    await expect(draft).toBeInViewport();
    await expect(draft).toHaveValue(
      "Черновик ответа сохраняется при прокрутке",
    );
    const top = page.getByRole("button", { name: "Наверх", exact: true });
    await list(page).evaluate((node) => {
      node.scrollTop = 360;
    });
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 361;
    });
    await expect(top).toBeVisible();
    await top.click();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    await expect(top).toHaveCount(0);
    await expect(draft).toHaveValue(
      "Черновик ответа сохраняется при прокрутке",
    );
  });

  test(`feed retains expanded text and the top button follows its active list at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await longListApi(page, "/feed");
    await gotoWithSession(page, "/feed");
    const first = list(page).locator(".ui-collection-item").first();
    await first
      .getByRole("button", { name: "Читать дальше →", exact: true })
      .click();
    await expect(
      first.getByRole("button", { name: "свернуть", exact: true }),
    ).toBeVisible();
    await list(page).focus();
    await loadAll(page);
    const top = page.getByRole("button", { name: "Наверх", exact: true });
    await expect(top).toBeVisible();
    await top.click();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    await expect(top).toHaveCount(0);
    await expect(
      first.getByRole("button", { name: "свернуть", exact: true }),
    ).toBeVisible();
    await list(page).evaluate((node) => {
      node.scrollTop = 360;
    });
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 361;
    });
    await expect(top).toBeVisible();
    await page.getByRole("button", { name: "Показать сеткой" }).click();
    await expect(list(page)).toHaveCount(1);
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 700;
    });
    await expect(top).toBeVisible();
    await top.click();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    await expect(top).toHaveCount(0);
    await page.getByRole("button", { name: "Показать лентой" }).click();
    await expect(list(page)).toHaveCount(1);
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 700;
    });
    await expect(top).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  });
}
