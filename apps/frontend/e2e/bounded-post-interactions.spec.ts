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
  page.locator("main .ui-scroll:not(.ui-scroll-horizontal)").first();
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
    writeStatus: 0,
    readStatus: 0,
    failedId: 0,
    foreign: false,
    gate: undefined as Promise<void> | undefined,
  };
  await editorApi(page, async (name, input) => {
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
      return ok(state.missing ? null : post(Number(input.id)));
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

for (const screen of ["feed", "club"]) {
  test(`${screen}: only loaded cards are requested, groups stay bounded and a save refreshes only its group`, async ({
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
    expect(state.reads.filter((read) => read.ids.length === 50)).toHaveLength(
      1,
    );
    const before = state.reads.length;
    await button.click();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(state.reads.slice(before).map((read) => read.ids)).toEqual([
      Array.from({ length: 22 }, (_, i) => i + 51),
    ]);
    expect(state.writes).toEqual([72]);
    expect(state.legacy).toBe(0);
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

test("detail requests one ID and confirmed marks reach the retained list before a delayed refresh", async ({
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
    expect(state.reads.at(-1)?.ids).toEqual([1]);
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
    expect(state.legacy).toBe(0);
  } finally {
    gate.release();
  }
});

test("recovering another post cannot unlock an uncertain save outside the read set", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  state.writeStatus = 500;
  await row(page, 1)
    .getByRole("button", { name: "Сохранить пост", exact: true })
    .click();
  await expect(retry(page)).toBeVisible();
  state.readStatus = 400;
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
