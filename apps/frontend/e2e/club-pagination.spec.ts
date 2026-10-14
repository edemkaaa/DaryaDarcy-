import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.setTimeout(60_000);
const ok = (data: unknown) => ({ result: { data: { json: data } } });
const failure = {
  error: {
    json: {
      message: "PRIVATE_PAGE_DETAILS",
      code: -32603,
      data: { code: "BAD_REQUEST", httpStatus: 400 },
    },
  },
};
const post = (id: number, tags = ["life"]) => ({
  id,
  text: `CLUB_POST_${id} ${"Проверка публикации и прокрутки. ".repeat(8)}`,
  target: "club",
  tags,
  photos: [],
  media: [],
  richText: null,
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date(Date.UTC(2026, 9, 5) - id * 60_000).toISOString(),
  publishedAt: new Date(Date.UTC(2026, 9, 5) - id * 60_000).toISOString(),
});
type Post = ReturnType<typeof post>;
type Input = { cursor?: number | null; limit?: number; tag?: string };

async function clubApi(
  page: Page,
  answer: (input: Input) => unknown | Promise<unknown>,
) {
  await layoutApi(page, true);
  // These tests check list behavior, not the availability of remote decoration.
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200"><rect width="480" height="200" fill="#8B7355"/></svg>',
    }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    const inputs = JSON.parse(url.searchParams.get("input") ?? "{}");
    const results = await Promise.all(
      names.map(async (name, index) => {
        if (name === "club.list") return answer(inputs[index]?.json ?? {});
        if (name === "club.subscription")
          return ok({
            hasClubAccess: true,
            subscribed: true,
            cancelAtPeriodEnd: false,
            expiresAt: "2040-11-01T10:00:00Z",
            isOwner: false,
            monthlyPrice: "790",
          });
        if (name === "feed.userInteractions")
          return ok({ likedIds: [], savedIds: [] });
        return ok([]);
      }),
    );
    await route.fulfill({
      json: url.searchParams.get("batch") === "1" ? results : results[0],
    });
  });
}

function paged(posts: Post[], input: Input) {
  const start = input.cursor ?? 0;
  const end = Math.min(start + (input.limit ?? 12), posts.length);
  return ok({
    posts: posts.slice(start, end),
    nextCursor: end < posts.length ? end : null,
  });
}
const list = (page: Page) =>
  page.locator("main .ui-scroll:not(.ui-scroll-horizontal)").first();
async function scrollToEnd(page: Page) {
  await list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
}
async function refreshList(page: Page) {
  await list(page).evaluate((node) => {
    node.scrollTop = 0;
    for (const [type, property, y] of [
      ["touchstart", "touches", 0],
      ["touchend", "changedTouches", 200],
    ] as const) {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, property, {
        value: [{ identifier: 1, target: node, clientY: y }],
      });
      node.dispatchEvent(event);
    }
  });
}

test("a club rubric finds a publication beyond the first 200 records", async ({
  page,
}) => {
  const posts = Array.from({ length: 221 }, (_, index) =>
    post(index + 1, index === 220 ? ["Комьюнити"] : ["life"]),
  );
  const calls: Input[] = [];
  await clubApi(page, (input) => {
    calls.push(input);
    return paged(posts, input);
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await page.getByRole("button", { name: "Комьюнити", exact: true }).click();
  await expect(page.getByText(/^CLUB_POST_221 /)).toBeVisible();
  await expect(
    page.getByText("Пока нет публикаций в этом разделе"),
  ).toHaveCount(0);
  expect(calls.some((input) => (input.cursor ?? 0) >= 200)).toBe(true);
  expect(
    calls.every((input) => input.limit === 12 && input.tag === undefined),
  ).toBe(true);
  expect(new Set(calls.map((input) => input.cursor ?? null)).size).toBe(
    calls.length,
  );
});

test("the unfiltered club list exposes all 221 posts through successive pages", async ({
  page,
}, testInfo) => {
  const posts = Array.from({ length: 221 }, (_, index) => post(index + 1));
  const calls: (number | null)[] = [];
  await clubApi(page, (input) => {
    calls.push(input.cursor ?? null);
    return paged(posts, input);
  });
  await gotoWithSession(page, "/club");
  const cards = list(page).locator(".ui-collection-item");
  await expect(cards).toHaveCount(12);
  const initialNodes = await list(page).evaluate(
    (node) => node.querySelectorAll("*").length,
  );
  for (let end = 24; end <= 228; end += 12) {
    await scrollToEnd(page);
    await expect(cards).toHaveCount(Math.min(end, 221));
  }
  await scrollToEnd(page);
  await expect(page.getByText(/^CLUB_POST_221 /)).toBeAttached();
  await list(page).evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  expect(calls).toEqual([
    null,
    ...Array.from({ length: 18 }, (_, index) => (index + 1) * 12),
  ]);
  await expect(page.getByRole("button", { name: "Загрузить ещё" })).toHaveCount(
    0,
  );
  await testInfo.attach("club-list-dom.json", {
    contentType: "application/json",
    body: JSON.stringify({
      initial: { posts: 12, nodes: initialNodes },
      final: {
        posts: 221,
        nodes: await list(page).evaluate(
          (node) => node.querySelectorAll("*").length,
        ),
      },
    }),
  });
});

test("appending a club page preserves scroll and removes overlapping IDs", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let nextCalls = 0;
  const messages: string[] = [];
  page.on("console", (message) => {
    if (/same key/i.test(message.text())) messages.push(message.text());
  });
  await clubApi(page, async (input) => {
    if (input.cursor == null)
      return ok({
        posts: Array.from({ length: 12 }, (_, i) => post(i + 1)),
        nextCursor: 12,
      });
    nextCalls++;
    await held;
    return ok({ posts: [post(12), post(13)], nextCursor: null });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await scrollToEnd(page);
  await expect.poll(() => nextCalls).toBe(1);
  const before = await list(page).evaluate((node) => node.scrollTop);
  await page.getByText(/^CLUB_POST_12 /).evaluate((node) => {
    node.dataset.testTop = String(node.getBoundingClientRect().top);
  });
  release();
  await expect(page.getByText(/^CLUB_POST_13 /)).toBeAttached();
  await expect(page.getByText(/^CLUB_POST_12 /)).toHaveCount(1);
  expect(
    Math.abs((await list(page).evaluate((node) => node.scrollTop)) - before),
  ).toBeLessThan(2);
  expect(
    await page
      .getByText(/^CLUB_POST_12 /)
      .evaluate((node) =>
        Math.abs(
          node.getBoundingClientRect().top - Number(node.dataset.testTop),
        ),
      ),
  ).toBeLessThan(2);
  await scrollToEnd(page);
  await expect(page.getByRole("button", { name: "Загрузить ещё" })).toHaveCount(
    0,
  );
  expect(nextCalls).toBe(1);
  expect(messages).toEqual([]);
});

test("a failed next page keeps loaded posts and retries the same cursor once", async ({
  page,
}) => {
  let fail = true;
  const calls: (number | null)[] = [];
  await clubApi(page, (input) => {
    calls.push(input.cursor ?? null);
    if (input.cursor == null)
      return ok({
        posts: Array.from({ length: 12 }, (_, i) => post(i + 1)),
        nextCursor: 12,
      });
    return fail ? failure : ok({ posts: [post(13)], nextCursor: null });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await scrollToEnd(page);
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить следующие публикации клуба" });
  await expect(error).toBeVisible();
  await expect(list(page).locator(".ui-collection-item")).toHaveCount(12);
  await list(page).evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await expect(page.getByText("PRIVATE_PAGE_DETAILS")).toHaveCount(0);
  expect(calls).toEqual([null, 12]);
  fail = false;
  await error.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText(/^CLUB_POST_13 /)).toBeAttached();
  await expect(error).toHaveCount(0);
  expect(calls).toEqual([null, 12, 12]);
});

test("an initial club error offers retry instead of an empty section", async ({
  page,
}) => {
  let fail = true;
  await clubApi(page, () =>
    fail ? failure : ok({ posts: [post(1)], nextCursor: null }),
  );
  await gotoWithSession(page, "/club");
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить публикации клуба" });
  await expect(error).toBeVisible();
  await expect(page.getByText("Публикации клуба скоро появятся")).toHaveCount(
    0,
  );
  fail = false;
  await error.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
});

test("retry in an empty filtered section displays loading until the page arrives", async ({
  page,
}) => {
  let fail = true;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await clubApi(page, async (input) => {
    if (input.cursor == null)
      return ok({
        posts: Array.from({ length: 12 }, (_, index) => post(index + 1)),
        nextCursor: 12,
      });
    if (fail) return failure;
    await held;
    return ok({ posts: [post(13, ["exclusive"])], nextCursor: null });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await page.getByRole("button", { name: "Эксклюзив", exact: true }).click();
  const error = page.getByRole("alert").filter({
    hasText: "Не удалось загрузить публикации клуба",
  });
  await expect(error).toBeVisible();
  fail = false;
  await error.getByRole("button", { name: "Повторить" }).click();
  await expect(
    page.getByRole("status", { name: "Загрузка материалов" }),
  ).toBeVisible();
  await expect(error).toHaveCount(0);
  release();
  await expect(page.getByText(/^CLUB_POST_13 /)).toBeVisible();
});

test("empty intermediate pages and legacy rubric aliases do not hide later matches", async ({
  page,
}) => {
  const calls: (number | null)[] = [];
  await clubApi(page, (input) => {
    calls.push(input.cursor ?? null);
    if (input.cursor == null) return ok({ posts: [post(1)], nextCursor: 1 });
    if (input.cursor === 1) return ok({ posts: [], nextCursor: 2 });
    return ok({ posts: [post(2, ["Письмо"])], nextCursor: null });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await page.getByRole("button", { name: "Эксклюзив", exact: true }).click();
  await expect(page.getByText(/^CLUB_POST_2 /)).toBeVisible();
  expect(calls).toEqual([null, 1, 2]);
  await page.getByRole("button", { name: "Подборки", exact: true }).click();
  await expect(
    page.getByText("Пока нет публикаций в этом разделе"),
  ).toBeVisible();
  expect(calls).toEqual([null, 1, 2]);
});

test("a repeated cursor stops automatic loading and exposes a recoverable error", async ({
  page,
}) => {
  const calls: (number | null)[] = [];
  await clubApi(page, (input) => {
    calls.push(input.cursor ?? null);
    return ok({ posts: [post(1)], nextCursor: 1 });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await page.getByRole("button", { name: "Подборки", exact: true }).click();
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить публикации клуба" });
  await expect(error).toBeVisible();
  expect(calls).toEqual([null, 1]);
  await page.getByRole("button", { name: "Лайф", exact: true }).click();
  await expect(page.getByText(/^CLUB_POST_1 /)).toHaveCount(1);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Не удалось загрузить следующие публикации клуба" }),
  ).toBeVisible();
  expect(calls).toEqual([null, 1]);
});

test("rubric and board filters find a Russian-tagged match on a later page", async ({
  page,
}) => {
  const posts = Array.from({ length: 25 }, (_, index) =>
    post(index + 1, index === 24 ? ["Лайф", "Весна"] : ["life", "winter"]),
  );
  const calls: Input[] = [];
  await clubApi(page, (input) => {
    calls.push(input);
    return paged(posts, input);
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await page.getByRole("button", { name: "Лайф", exact: true }).click();
  await page.getByRole("button", { name: "Открыть фильтры клуба" }).click();
  await page.getByRole("button", { name: "Весна", exact: true }).click();
  await page.getByRole("button", { name: "Закрыть фильтры клуба" }).click();
  await expect(page.getByText(/^CLUB_POST_25 /)).toBeVisible();
  await expect(page.getByText(/^CLUB_POST_1 /)).toHaveCount(0);
  expect(calls.map((input) => input.cursor ?? null)).toEqual([null, 12, 24]);
  const reset = page.getByRole("button", {
    name: "Сбросить фильтр клуба: spring",
    exact: true,
  });
  await expect(reset).toHaveText("spring ×");
  await reset.click();
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeAttached();
  expect(calls).toHaveLength(3);
});

test("pull to refresh updates the loaded page without losing its posts", async ({
  page,
}) => {
  let updated = false;
  let calls = 0;
  await clubApi(page, () => {
    calls++;
    return ok({
      posts: [
        { ...post(1), text: updated ? "REFRESHED_CLUB_POST" : post(1).text },
      ],
      nextCursor: null,
    });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  updated = true;
  await refreshList(page);
  await expect(
    page.getByText("REFRESHED_CLUB_POST", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(2);
});

test("refresh failure retains loaded pages and retry refreshes them in order", async ({
  page,
}) => {
  const posts = Array.from({ length: 13 }, (_, index) => post(index + 1));
  const calls: (number | null)[] = [];
  let fail = false;
  let updated = false;
  await clubApi(page, (input) => {
    calls.push(input.cursor ?? null);
    if (fail) return failure;
    return paged(
      posts.map((item) =>
        updated && item.id === 13
          ? { ...item, text: "REFRESHED_LAST_CLUB_POST" }
          : item,
      ),
      input,
    );
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await scrollToEnd(page);
  await expect(page.getByText(/^CLUB_POST_13 /)).toBeAttached();
  fail = true;
  await refreshList(page);
  const error = page.getByRole("alert").filter({
    hasText: "Не удалось обновить публикации клуба",
  });
  await expect(error).toBeAttached();
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeAttached();
  await expect(list(page).locator(".ui-collection-item")).toHaveCount(13);
  expect(calls).toEqual([null, 12, null]);
  fail = false;
  updated = true;
  await error.getByRole("button", { name: "Повторить" }).click();
  await expect(error).toHaveCount(0);
  await scrollToEnd(page);
  await expect(
    page.getByText("REFRESHED_LAST_CLUB_POST", { exact: true }),
  ).toBeAttached();
  await expect(error).toHaveCount(0);
  expect(calls).toEqual([null, 12, null, null, 12]);
});
