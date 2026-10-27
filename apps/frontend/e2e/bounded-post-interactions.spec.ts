import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.setTimeout(60_000);
const post = (id: number) => ({
  id,
  text: `BOUNDED_POST_${id}`,
  photos: [],
  media: [],
  tags: [],
  target: "both",
  published: true,
  status: "published",
  richText: null,
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-04T10:00:00Z",
  publishedAt: "2026-10-04T10:00:00Z",
});
const list = (page: Page) =>
  page.locator("main .ui-scroll:not(.ui-scroll-horizontal):visible").first();
const row = (page: Page, id: number) =>
  page
    .locator(".ui-collection-item")
    .filter({ has: page.getByText(`BOUNDED_POST_${id}`, { exact: true }) });
const save = (page: Page) =>
  page.getByRole("button", { name: "Сохранить пост", exact: true });
const retry = (page: Page) =>
  page.getByRole("button", { name: "Обновить отметки", exact: true });
const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

async function fixture(page: Page, count = 2) {
  const state = {
    owner: 101,
    guest: false,
    count,
    legacy: 0,
    missing: false,
    reads: [] as { owner: number; ids: number[] }[],
    saved: new Set<number>(),
    liked: new Set<number>(),
    writes: [] as number[],
    calls: [] as { name: string; input: Record<string, unknown> }[],
    writeStatus: 0,
    readStatus: 0,
    failedId: 0,
    foreign: false,
    gate: undefined as Promise<void> | undefined,
  };
  await editorApi(page, async (name, input) => {
    state.calls.push({ name, input });
    if (name === "club.subscription")
      return ok({
        hasClubAccess: true,
        subscribed: true,
        expiresAt: "2040-11-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        cancellationStatus: "none",
        isOwner: false,
        monthlyPrice: "790",
      });
    if (name === "feed.listPaginated" || name === "club.listByCategory") {
      const start = Number(input.cursor ?? 0),
        end = Math.min(start + Number(input.limit), state.count);
      return ok({
        posts: Array.from({ length: end - start }, (_, i) =>
          post(start + i + 1),
        ),
        nextCursor: end < state.count ? end : null,
      });
    }
    if (name === "feed.getById")
      return ok(
        state.missing
          ? null
          : {
              ...post(Number(input.id)),
              likeCount: state.liked.has(Number(input.id)) ? 1 : 0,
            },
      );
    if (name === "feed.savedPostsPage") {
      const after = Number(String(input.cursor ?? "saved:0").split(":")[1]);
      const ids = [...state.saved]
        .sort((a, b) => a - b)
        .filter((id) => id > after);
      const pageIds = ids.slice(0, Number(input.limit));
      return ok({
        items: pageIds.map(post),
        nextCursor:
          ids.length > pageIds.length ? `saved:${pageIds.at(-1)}` : null,
      });
    }
    if (name === "feed.userInteractions") {
      state.legacy++;
      return ok({ likedIds: [], savedIds: [] });
    }
    if (name === "feed.interactionsForPosts") {
      const ids = input.postIds as number[];
      state.reads.push({ owner: state.owner, ids });
      const result =
        state.readStatus || ids.includes(state.failedId)
          ? failure(state.readStatus || 400)
          : ok({
              likedIds: ids.filter((id) => state.liked.has(id)),
              savedIds: state.foreign
                ? [99999]
                : ids.filter((id) => state.saved.has(id)),
            });
      await state.gate;
      return result;
    }
    if (name === "feed.toggleSave") {
      const id = Number(input.postId);
      state.writes.push(id);
      if (state.writeStatus) return failure(state.writeStatus);
      if (state.saved.has(id)) state.saved.delete(id);
      else state.saved.add(id);
      return ok(state.saved.has(id));
    }
    if (name === "feed.toggleLike") {
      const id = Number(input.postId);
      if (state.liked.has(id)) state.liked.delete(id);
      else state.liked.add(id);
      return ok(state.liked.has(id));
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: state.guest
          ? null
          : {
              id: state.owner,
              openId: `member-${state.owner}`,
              name: "Участница",
              gender: "female",
              role: "user",
              email: "member@example.test",
              lastSignedIn: "2026-10-04T10:00:00Z",
            },
      },
    }),
  );
  return state;
}

test("unsaving a retained second-page card removes it even when the refreshed head is unchanged", async ({
  page,
}) => {
  const state = await fixture(page, 22);
  state.saved = new Set(Array.from({ length: 22 }, (_, i) => i + 1));
  await gotoWithSession(page, "/profile");
  await page
    .getByRole("button", { name: "Загрузить ещё сохранённые", exact: true })
    .click();
  const card = (id: number) =>
    page.getByRole("button", {
      name: `Открыть публикацию: BOUNDED_POST_${id}`,
      exact: true,
    });
  await card(22).click();
  await expect(page).toHaveURL(/\/post\/22$/);
  await expect(save(page)).toBeEnabled();
  await expect(save(page)).toHaveAttribute("aria-pressed", "true");
  state.calls.length = 0;
  await save(page).click();
  await expect(save(page)).toBeEnabled();
  await expect(save(page)).toHaveAttribute("aria-pressed", "false");
  expect(state.calls.map(({ name }) => name)).toEqual(["feed.toggleSave"]);
  await page.goBack();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(card(21)).toBeVisible();
  await expect(card(22)).toHaveCount(0);
  await expect
    .poll(() => state.calls.some(({ name }) => name === "feed.savedPostsPage"))
    .toBe(true);
  expect(state.saved.has(22)).toBe(false);
});

for (const screen of ["feed", "club"]) {
  test(`${screen}: loaded groups stay bounded; confirmed reactions do not reload groups or pages`, async ({
    page,
  }) => {
    const state = await fixture(page, 72);
    await gotoWithSession(page, `/${screen}`);
    await expect
      .poll(() => state.reads.some((read) => read.ids.includes(12)))
      .toBe(true);
    expect(state.reads[0].ids).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    for (let last = 24; last <= 72; last += 12) {
      await list(page).evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect
        .poll(() => state.reads.some((read) => read.ids.includes(last)))
        .toBe(true);
    }
    const button = row(page, 72).getByRole("button", {
      name: "Сохранить пост",
      exact: true,
    });
    await expect(button).toBeEnabled();
    expect(
      state.reads.every(
        (read) =>
          read.ids.length > 0 &&
          read.ids.length <= 50 &&
          new Set(read.ids).size === read.ids.length,
      ),
    ).toBe(true);
    expect(state.reads.map((read) => read.ids)).toEqual(
      Array.from({ length: 6 }, (_, page) =>
        Array.from({ length: 12 }, (_, i) => page * 12 + i + 1),
      ),
    );
    const before = state.reads.length;
    await button.click();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(state.reads.slice(before)).toEqual([]);
    expect(state.writes).toEqual([72]);
    expect(state.legacy).toBe(0);
    state.calls.length = 0;
    const like = row(page, 72).getByRole("button", {
      name: "Нравится",
      exact: true,
    });
    await like.click();
    await expect(like).toBeEnabled();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    expect(state.calls.map(({ name }) => name)).toEqual([
      "feed.toggleLike",
      "feed.getById",
    ]);
    expect(state.calls[1].input).toEqual({ id: 72 });
    if (screen === "feed") await expect(like).toHaveText(/(?:^|\D)1$/);
  });
}

test("one failed group does not block ready cards, and an explicit retry recovers it", async ({
  page,
}) => {
  const state = await fixture(page, 60);
  state.failedId = 60;
  await gotoWithSession(page, "/feed");
  await expect
    .poll(() => state.reads.some((read) => read.ids.includes(12)))
    .toBe(true);
  for (let last = 24; last <= 60; last += 12) {
    await list(page).evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect
      .poll(() => state.reads.some((read) => read.ids.includes(last)))
      .toBe(true);
  }
  await expect(
    row(page, 60).getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeDisabled();
  await list(page).evaluate((node) => {
    node.scrollTop = 0;
  });
  const first = row(page, 1).getByRole("button", {
    name: "Сохранить пост",
    exact: true,
  });
  await expect(first).toBeEnabled();
  await first.click();
  await expect(first).toBeEnabled();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(retry(page)).toBeVisible();
  state.failedId = 0;
  await retry(page).click();
  await expect(retry(page)).toHaveCount(0);
  await list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    row(page, 60).getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toEqual([1]);
});

test("detail reuses fresh marks and confirmed changes reach the retained list without another read", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  try {
    await gotoWithSession(page, "/feed");
    await expect(
      row(page, 1).getByRole("button", { name: "Сохранить пост", exact: true }),
    ).toBeEnabled();
    await page.getByText("BOUNDED_POST_1", { exact: true }).click();
    await expect(page).toHaveURL(/\/post\/1$/);
    await expect(save(page)).toHaveCount(1);
    await expect(save(page)).toBeEnabled();
    expect(state.reads.map((read) => read.ids)).toEqual([[1, 2]]);
    await save(page).click();
    await expect(save(page)).toBeEnabled();
    state.gate = gate.promise;
    await page.goBack();
    const saved = row(page, 1).getByRole("button", {
      name: "Сохранить пост",
      exact: true,
    });
    await expect(saved).toHaveAttribute("aria-pressed", "true");
    gate.release();
    await expect(saved).toBeEnabled();
    expect(state.reads.map((read) => read.ids)).toEqual([[1, 2]]);
    expect(state.legacy).toBe(0);
  } finally {
    gate.release();
  }
});

test("a cold detail reads only its post", async ({ page }) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/post/2");
  await expect(save(page)).toBeEnabled();
  expect(state.reads.map((read) => read.ids)).toEqual([[2]]);
});

test("feed and club reuse overlapping marks and request only previously unseen posts", async ({
  page,
}) => {
  const state = await fixture(page, 24);
  const first = () =>
    row(page, 1).getByRole("button", { name: "Сохранить пост", exact: true });
  await gotoWithSession(page, "/feed");
  await expect(first()).toBeEnabled();
  await page.locator('nav[aria-label="Разделы"] a[href="/club"]').click();
  await expect(page).toHaveURL(/\/club$/);
  await expect(first()).toBeEnabled();
  // The club may already prefetch the next page to fill its viewport. Its
  // overlapping first page must still reuse the feed's existing marks.
  expect(
    state.reads.flatMap((read) => read.ids).filter((id) => id <= 12),
  ).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  await list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    row(page, 24).getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeEnabled();
  await page.goBack();
  await expect(page).toHaveURL(/\/feed$/);
  await list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    row(page, 24).getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeEnabled();
  expect(state.reads.map((read) => read.ids)).toEqual([
    Array.from({ length: 12 }, (_, i) => i + 1),
    Array.from({ length: 12 }, (_, i) => i + 13),
  ]);
});

test("opening a detail after freshness expires reads its current mark without reloading other marks", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  await expect(
    row(page, 1).getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeEnabled();
  state.saved.add(1);
  await page.clock.fastForward(31_000);
  await page.getByText("BOUNDED_POST_1", { exact: true }).click();
  await expect(page).toHaveURL(/\/post\/1$/);
  await expect(save(page)).toBeEnabled();
  await expect(save(page)).toHaveAttribute("aria-pressed", "true");
  expect(state.reads.map((read) => read.ids)).toEqual([[1, 2], [1]]);
});

for (const event of ["visibilitychange", "online"]) {
  test(`${event}: fresh cached marks are rechecked in a batch`, async ({
    page,
  }) => {
    const state = await fixture(page, 12);
    await gotoWithSession(page, "/feed");
    const first = row(page, 1).getByRole("button", {
      name: "Сохранить пост",
      exact: true,
    });
    await expect(first).toBeEnabled();
    state.saved.add(1);
    await page.evaluate((event) => {
      if (event === "online") window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event(event));
    }, event);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(first).toBeEnabled();
    expect(state.reads.map((read) => read.ids)).toEqual([
      Array.from({ length: 12 }, (_, i) => i + 1),
      Array.from({ length: 12 }, (_, i) => i + 1),
    ]);
  });
}

test("recovering another post cannot unlock an uncertain save outside the read set", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.clock.install();
  await gotoWithSession(page, "/feed");
  state.writeStatus = 500;
  await row(page, 1)
    .getByRole("button", { name: "Сохранить пост", exact: true })
    .click();
  await expect(retry(page)).toBeVisible();
  state.readStatus = 400;
  await page.clock.fastForward(31_000);
  await page.getByText("BOUNDED_POST_2", { exact: true }).click();
  await expect(page).toHaveURL(/\/post\/2$/);
  await expect(save(page)).toHaveCount(1);
  await expect(retry(page)).toBeVisible();
  await expect(save(page)).toBeDisabled();
  state.readStatus = 0;
  await retry(page).click();
  await expect(save(page)).toBeEnabled();
  await expect(retry(page)).toHaveCount(0);
  await page.goBack();
  const first = row(page, 1).getByRole("button", {
    name: "Сохранить пост",
    exact: true,
  });
  await expect(first).toBeDisabled();
  await expect(retry(page)).toBeVisible();
  await retry(page).click();
  await expect(first).toBeEnabled();
  expect(state.writes).toEqual([1]);
});

for (const mode of ["guest", "empty", "missing"] as const) {
  test(`${mode}: no interaction request is sent`, async ({ page }) => {
    const state = await fixture(page, mode === "empty" ? 0 : 2);
    state.guest = mode === "guest";
    state.missing = mode === "missing";
    await gotoWithSession(page, mode === "missing" ? "/post/1" : "/feed");
    if (mode === "guest")
      await expect(
        page.getByText("BOUNDED_POST_1", { exact: true }),
      ).toBeVisible();
    else if (mode === "empty")
      await expect(
        page.getByText("Публикаций пока нет", { exact: true }),
      ).toBeVisible();
    else {
      await expect(
        page.getByText("Пост не найден", { exact: true }),
      ).toBeVisible();
      await expect(save(page)).toHaveCount(0);
    }
    expect(state.reads).toEqual([]);
    expect(state.legacy).toBe(0);
  });
}

for (const mode of ["foreign ID", "404"] as const) {
  test(`${mode}: invalid or missing bounded API never enables toggles or falls back to account history`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.foreign = mode === "foreign ID";
    state.readStatus = mode === "404" ? 404 : 0;
    await gotoWithSession(page, "/post/1");
    await expect(retry(page)).toBeVisible();
    await expect(save(page)).toBeDisabled();
    expect(state.writes).toEqual([]);
    expect(state.legacy).toBe(0);
  });
}

test("a late read for a previous account cannot restore its marks", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.saved.add(1);
  state.gate = gate.promise;
  try {
    await gotoWithSession(page, "/post/1");
    await expect.poll(() => state.reads.length).toBe(1);
    state.owner = 202;
    state.saved.clear();
    state.gate = undefined;
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "new-owner",
        }),
      ),
    );
    await expect(save(page)).toBeEnabled();
    gate.release();
    await expect(save(page)).toHaveAttribute("aria-pressed", "false");
    expect(state.reads).toEqual([
      { owner: 101, ids: [1] },
      { owner: 202, ids: [1] },
    ]);
  } finally {
    gate.release();
  }
});
