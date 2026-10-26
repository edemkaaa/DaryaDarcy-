import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import {
  postMatchesClubTab,
  type ClubTabId,
} from "../../../packages/shared/src/club-tags";
import { postFilterTagAliases } from "../../../packages/shared/src/post-tag-aliases";

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
type Input = {
  cursor?: number | null;
  limit?: number;
  tag?: string;
  category?: ClubTabId;
};

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
        if (name === "club.listByCategory")
          return answer(inputs[index]?.json ?? {});
        if (name === "club.subscription")
          return ok({
            hasClubAccess: true,
            subscribed: true,
            cancelAtPeriodEnd: false,
            cancellationStatus: "none",
            expiresAt: "2040-11-01T10:00:00Z",
            isOwner: false,
            monthlyPrice: "790",
          });
        if (name === "feed.interactionsForPosts")
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
  const matches = posts.filter(
    (row) =>
      (!input.category || postMatchesClubTab(row.tags, input.category)) &&
      (!input.tag ||
        row.tags.some((tag) =>
          postFilterTagAliases(input.tag!).includes(tag.trim().toLowerCase()),
        )),
  );
  const start = input.cursor ?? 0;
  const end = Math.min(start + (input.limit ?? 12), matches.length);
  return ok({
    posts: matches.slice(start, end),
    nextCursor: end < matches.length ? end : null,
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
      if (type === "touchend")
        Object.defineProperty(event, "touches", { value: [] });
      node.dispatchEvent(event);
    }
  });
}

test("a club rubric finds a publication beyond the first 200 records without downloading the archive", async ({
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
  expect(calls).toEqual([{ limit: 12 }, { limit: 12, category: "community" }]);
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
    if (!input.category)
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

test("a server-filtered empty rubric stops without scanning unrelated pages", async ({
  page,
}) => {
  const calls: Input[] = [];
  await clubApi(page, (input) => {
    calls.push(input);
    if (input.category === "podborki")
      return ok({ posts: [], nextCursor: null });
    if (input.category === "exclusive")
      return ok({ posts: [post(2, ["Письмо"])], nextCursor: null });
    return ok({ posts: [post(1)], nextCursor: null });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await page.getByRole("button", { name: "Эксклюзив", exact: true }).click();
  await expect(page.getByText(/^CLUB_POST_2 /)).toBeVisible();
  await page.getByRole("button", { name: "Подборки", exact: true }).click();
  await expect(
    page.getByText("Пока нет публикаций в этом разделе"),
  ).toBeVisible();
  expect(calls).toEqual([
    { limit: 12 },
    { limit: 12, category: "exclusive" },
    { limit: 12, category: "podborki" },
  ]);
});

test("a repeated cursor stops automatic loading and exposes a recoverable error", async ({
  page,
}) => {
  const calls: Input[] = [];
  await clubApi(page, (input) => {
    calls.push(input);
    if (input.category === "life")
      return ok({ posts: [post(99)], nextCursor: null });
    return ok({
      posts: Array.from({ length: 12 }, (_, index) => post(index + 1)),
      nextCursor: 12,
    });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await scrollToEnd(page);
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить следующие публикации клуба" });
  await expect(error).toBeVisible();
  expect(calls).toEqual([{ limit: 12 }, { limit: 12, cursor: 12 }]);
  await page.getByRole("button", { name: "Лайф", exact: true }).click();
  await expect(page.getByText(/^CLUB_POST_99 /)).toBeVisible();
  await expect(error).toHaveCount(0);
  await expect
    .poll(() => calls.at(-1))
    .toEqual({ limit: 12, category: "life" });
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
  expect(calls).toEqual([
    { limit: 12 },
    { limit: 12, category: "life" },
    { limit: 12, category: "life", tag: "spring" },
  ]);
  const reset = page.getByRole("button", {
    name: "Сбросить фильтр клуба: spring",
    exact: true,
  });
  await expect(reset).toHaveText("spring ×");
  await reset.click();
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeAttached();
  // The previous category page is still fresh in the 30-second query cache.
  await expect(list(page).locator(".ui-collection-item")).toHaveCount(12);
  expect(calls).toHaveLength(3);
  await refreshList(page);
  await expect
    .poll(() => calls.at(-1))
    .toEqual({ limit: 12, category: "life" });
  expect(calls.every((input) => input.cursor === undefined)).toBe(true);
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

test("pagination uses offsets within the selected category and board tag", async ({
  page,
}) => {
  const posts = [
    ...Array.from({ length: 200 }, (_, i) => post(i + 1)),
    ...Array.from({ length: 25 }, (_, i) =>
      post(i + 201, ["Эксклюзив", "Весна"]),
    ),
  ];
  const calls: Input[] = [];
  await clubApi(page, (input) => {
    calls.push(input);
    return paged(posts, input);
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await page.getByRole("button", { name: "Эксклюзив", exact: true }).click();
  await expect(page.getByText(/^CLUB_POST_201 /)).toBeVisible();
  await page.getByRole("button", { name: "Открыть фильтры клуба" }).click();
  await page.getByRole("button", { name: "Весна", exact: true }).click();
  await page.getByRole("button", { name: "Закрыть фильтры клуба" }).click();
  const cards = list(page).locator(".ui-collection-item");
  await expect(cards).toHaveCount(12);
  await scrollToEnd(page);
  await expect(cards).toHaveCount(24);
  await scrollToEnd(page);
  await expect(cards).toHaveCount(25);
  await expect(page.getByText(/^CLUB_POST_225 /)).toBeAttached();
  expect(calls.filter((input) => input.tag === "spring")).toEqual([
    { limit: 12, category: "exclusive", tag: "spring" },
    { limit: 12, category: "exclusive", tag: "spring", cursor: 12 },
    { limit: 12, category: "exclusive", tag: "spring", cursor: 24 },
  ]);
  // Turning off the rubric keeps the board tag, but starts another cursor chain.
  await page.getByRole("button", { name: "Эксклюзив", exact: true }).click();
  await expect.poll(() => calls.at(-1)).toEqual({ limit: 12, tag: "spring" });
  await expect(cards).toHaveCount(12);
});

for (const pending of ["head", "next"] as const) {
  test(`switching rubric cancels the previous ${pending} response and resets the cursor`, async ({
    page,
  }) => {
    const calls: Input[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let cancelled = false;
    page.on("requestfailed", (request) => {
      if (request.url().includes("club.listByCategory")) cancelled = true;
    });
    await clubApi(page, async (input) => {
      calls.push(input);
      if (input.category === "exclusive")
        return ok({ posts: [post(99, ["exclusive"])], nextCursor: null });
      if (input.category === "community") {
        if (pending === "head" || input.cursor != null) {
          await held;
          return ok({ posts: [post(88, ["community"])], nextCursor: null });
        }
        return ok({
          posts: Array.from({ length: 12 }, (_, i) =>
            post(i + 20, ["community"]),
          ),
          nextCursor: 12,
        });
      }
      return ok({ posts: [post(1)], nextCursor: null });
    });
    try {
      await gotoWithSession(page, "/club");
      await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
      await page
        .getByRole("button", { name: "Комьюнити", exact: true })
        .click();
      if (pending === "next") {
        await expect(page.getByText(/^CLUB_POST_20 /)).toBeVisible();
        await scrollToEnd(page);
      }
      await expect.poll(() => calls.length).toBe(pending === "head" ? 2 : 3);
      await page
        .getByRole("button", { name: "Эксклюзив", exact: true })
        .click();
      await expect(page.getByText(/^CLUB_POST_99 /)).toBeVisible();
      await expect.poll(() => cancelled).toBe(true);
      release();
      await refreshList(page);
      await expect
        .poll(
          () => calls.filter((input) => input.category === "exclusive").length,
        )
        .toBe(2);
      await expect(page.getByText(/^CLUB_POST_88 /)).toHaveCount(0);
      expect(
        calls
          .filter((input) => input.category === "exclusive")
          .every((input) => input.cursor === undefined),
      ).toBe(true);
      await expect(list(page).locator(".ui-collection-item")).toHaveCount(1);
    } finally {
      release();
    }
  });
}

test("a missing category API is an error, never an unfiltered fallback", async ({
  page,
}) => {
  await clubApi(page, () => ok({ posts: [post(1)], nextCursor: null }));
  const calls: string[] = [];
  await page.route("**/api/trpc/**", async (route) => {
    const names = new URL(route.request().url()).pathname
      .split("/api/trpc/")[1]
      .split(",");
    calls.push(...names);
    if (names.includes("club.listByCategory")) {
      await route.fulfill({
        json: names.map(() => ({
          error: {
            json: {
              message: "No procedure",
              code: -32004,
              data: { code: "NOT_FOUND", httpStatus: 404 },
            },
          },
        })),
      });
    } else await route.fallback();
  });
  await gotoWithSession(page, "/club");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Не удалось загрузить публикации клуба" }),
  ).toBeVisible();
  await expect(page.getByText("Публикации клуба скоро появятся")).toHaveCount(
    0,
  );
  expect(calls.filter((name) => name === "club.listByCategory")).toHaveLength(
    1,
  );
  expect(calls).not.toContain("club.list");
});

for (const status of [400, 503]) {
  test(`refresh failure ${status} retains loaded pages and retry refreshes them in order`, async ({
    page,
  }) => {
    const posts = Array.from({ length: 13 }, (_, index) => post(index + 1));
    const calls: (number | null)[] = [];
    let fail = false;
    let updated = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await clubApi(page, async (input) => {
      calls.push(input.cursor ?? null);
      if (fail) {
        await held;
        return {
          error: {
            json: {
              message: "PRIVATE_REFRESH_DETAILS",
              code: -32603,
              data: {
                code: status === 503 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST",
                httpStatus: status,
              },
            },
          },
        };
      }
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
    await expect.poll(() => calls.length).toBe(3);
    // A pending refresh must preserve the whole confirmed list too.
    try {
      await expect(list(page).locator(".ui-collection-item")).toHaveCount(13);
    } finally {
      release();
    }
    const error = page.getByRole("status").filter({
      hasText: "Не удалось обновить публикации клуба",
    });
    await expect(error).toBeAttached();
    await expect(page.getByText(/^CLUB_POST_1 /)).toBeAttached();
    await expect(list(page).locator(".ui-collection-item")).toHaveCount(13);
    const failedReads = status === 503 ? [null, null] : [null];
    expect(calls).toEqual([null, 12, ...failedReads]);
    fail = false;
    updated = true;
    await error.getByRole("button", { name: "Повторить" }).click();
    await expect(error).toHaveCount(0);
    await scrollToEnd(page);
    await expect(
      page.getByText("REFRESHED_LAST_CLUB_POST", { exact: true }),
    ).toBeAttached();
    await expect(list(page).locator(".ui-collection-item")).toHaveCount(13);
    await expect(page.getByText(/^CLUB_POST_13 /)).toHaveCount(0);
    await expect(error).toHaveCount(0);
    expect(calls).toEqual([null, 12, ...failedReads, null, 12]);
  });
}

test("a forbidden refresh hides all retained club pages", async ({ page }) => {
  const posts = Array.from({ length: 13 }, (_, index) => post(index + 1));
  let denied = false;
  await clubApi(page, (input) =>
    denied
      ? {
          error: {
            json: {
              message: "Club access ended",
              code: -32003,
              data: { code: "FORBIDDEN", httpStatus: 403 },
            },
          },
        }
      : paged(posts, input),
  );
  await gotoWithSession(page, "/club");
  await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
  await scrollToEnd(page);
  await expect(page.getByText(/^CLUB_POST_13 /)).toBeAttached();
  denied = true;
  await refreshList(page);
  await expect(page.getByText(/^CLUB_POST_\d+ /)).toHaveCount(0);
});

test("refresh cancels an older page request before starting a new chain", async ({
  page,
}) => {
  const calls: (number | null)[] = [];
  let nextCalls = 0;
  let cancelled = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (
      decodeURIComponent(url.pathname).includes("club.listByCategory") &&
      url.searchParams.get("input")?.includes('"cursor":12')
    )
      cancelled = true;
  });
  await clubApi(page, async (input) => {
    calls.push(input.cursor ?? null);
    if (input.cursor == null)
      return ok({
        posts: Array.from({ length: 12 }, (_, index) => post(index + 1)),
        nextCursor: 12,
      });
    if (++nextCalls === 1) {
      await held;
      return ok({ posts: [post(99)], nextCursor: null });
    }
    return ok({ posts: [post(13)], nextCursor: null });
  });
  try {
    await gotoWithSession(page, "/club");
    await expect(page.getByText(/^CLUB_POST_1 /)).toBeVisible();
    await scrollToEnd(page);
    await expect.poll(() => nextCalls).toBe(1);
    await refreshList(page);
    await expect.poll(() => cancelled).toBe(true);
    await expect.poll(() => calls).toEqual([null, 12, null]);
    await expect(list(page).locator(".ui-refresh")).toHaveCount(0);
    release();
    await scrollToEnd(page);
    await expect(page.getByText(/^CLUB_POST_13 /)).toBeAttached();
    await expect(page.getByText(/^CLUB_POST_99 /)).toHaveCount(0);
    expect(calls).toEqual([null, 12, null, 12]);
  } finally {
    release();
  }
});
