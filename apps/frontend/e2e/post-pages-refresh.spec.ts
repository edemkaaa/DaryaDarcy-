import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok, failure } from "./editor-fixtures";

const list = (page: Page) =>
  page.locator("main .ui-scroll:not(.ui-scroll-horizontal):visible").first();
const post = (id: number) => ({
  id,
  text: `PAGE_POST_${id}_v0 ${"Текст публикации для проверки прокрутки. ".repeat(10)}`,
  photos: [],
  media: [],
  richText: null,
  tags: ["life"],
  target: "both",
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date(Date.UTC(2026, 9, 20) - id * 60_000).toISOString(),
  publishedAt: new Date(Date.UTC(2026, 9, 20) - id * 60_000).toISOString(),
});
async function setup(
  page: Page,
  club: boolean,
  total = 144,
  community = false,
) {
  let rows = Array.from({ length: total }, (_, i) => post(i + 1));
  if (community) rows = rows.map((row) => ({ ...row, tags: ["Комьюнити"] }));
  const calls: number[] = [];
  let failedCursor: number | undefined;
  await layoutApi(page, club, (name, input) => {
    if (name !== (club ? "club.listByCategory" : "feed.listPaginated")) return;
    const cursor = Number(input.cursor ?? 0);
    calls.push(cursor);
    if (failedCursor === cursor) return failure(400);
    return ok({
      posts: rows.slice(cursor, cursor + 12),
      nextCursor: cursor + 12 < rows.length ? cursor + 12 : null,
    });
  });
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200"/>',
    }),
  );
  await gotoWithSession(page, club ? "/club" : "/feed");
  await expect(page.getByText(/^PAGE_POST_1_v0 /).first()).toBeVisible();
  return {
    calls,
    edit: (id: number) => {
      rows = rows.map((row) =>
        row.id === id ? { ...row, text: row.text.replace("_v0", "_v1") } : row,
      );
    },
    remove: (id: number) => {
      rows = rows.filter((row) => row.id !== id);
    },
    fail: (cursor?: number) => {
      failedCursor = cursor;
    },
  };
}
async function end(page: Page) {
  await list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
}
async function loadThrough(page: Page, endId: number) {
  for (let id = 24; id <= endId; id += 12) {
    await end(page);
    await expect(list(page).locator(`[data-item-key="${id}"]`)).toBeAttached();
  }
}
async function minute(page: Page) {
  await page.clock.fastForward(61_000);
  await page.clock.runFor(200);
}

for (const club of [false, true]) {
  test(`${club ? "club" : "guest feed"}: polls visible later pages, reflects edits and deletion, preserves position`, async ({
    page,
  }) => {
    await page.clock.install();
    const f = await setup(page, club);
    await loadThrough(page, 72);
    // Scroll using the measured row so the window mounts its text.
    await list(page).locator('[data-item-index="37"]').scrollIntoViewIfNeeded();
    await list(page).evaluate((node) => {
      const row = node.querySelector('[data-item-key="38"]')!;
      node.scrollTop +=
        row.getBoundingClientRect().top - node.getBoundingClientRect().top;
    });
    await expect(page.getByText(/^PAGE_POST_38_v0 /).first()).toBeInViewport();
    await page.clock.runFor(200);
    const before = f.calls.length;
    const anchor = page.getByText(/^PAGE_POST_38_v0 /).first();
    const y = (await anchor.boundingBox())!.y;
    f.edit(38);
    await minute(page);
    await expect(page.getByText(/^PAGE_POST_38_v1 /).first()).toBeInViewport();
    const visibleReads = f.calls.slice(before);
    expect(visibleReads).toContain(0);
    expect(visibleReads).toContain(36);
    expect(visibleReads.every((cursor) => [0, 24, 36].includes(cursor))).toBe(
      true,
    );
    expect(new Set(visibleReads).size).toBe(visibleReads.length);
    expect(
      Math.abs(
        (await page
          .getByText(/^PAGE_POST_38_v1 /)
          .first()
          .boundingBox())!.y - y,
      ),
    ).toBeLessThan(2);
    const deletedAt = f.calls.length;
    f.remove(37);
    await minute(page);
    await expect(page.getByText(/^PAGE_POST_37_v0 /)).toHaveCount(0);
    await expect(page.getByText(/^PAGE_POST_38_v1 /).first()).toBeInViewport();
    const cursors = f.calls.slice(deletedAt);
    expect(new Set(cursors)).toEqual(new Set([0, 12, 24, 36, 48, 60]));
    expect(cursors).toHaveLength(6);
    expect(
      Math.abs(
        (await page
          .getByText(/^PAGE_POST_38_v1 /)
          .first()
          .boundingBox())!.y - y,
      ),
    ).toBeLessThan(2);
  });

  test(`${club ? "club" : "guest feed"}: bounds pages, loads backwards and returns directly to head`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const f = await setup(page, club);
    await loadThrough(page, 120);
    await expect(list(page).locator(".ui-collection-item:visible")).toHaveCount(
      96,
    );
    expect(f.calls).toEqual(Array.from({ length: 10 }, (_, i) => i * 12));
    // The first retained page starts at offset 24. Returning to its top loads
    // offset 12 while preserving the currently visible card.
    await list(page).locator('[data-item-index="0"]').scrollIntoViewIfNeeded();
    await expect
      .poll(
        () =>
          f.calls.includes(12) &&
          f.calls.filter((cursor) => cursor === 12).length,
      )
      .toBe(2);
    await expect(list(page).locator(".ui-collection-item:visible")).toHaveCount(
      96,
    );
    await expect(page.getByText(/^PAGE_POST_25_v0 /).first()).toBeInViewport();
    await page.getByRole("button", { name: "Наверх", exact: true }).click();
    await expect(page.getByText(/^PAGE_POST_1_v0 /).first()).toBeVisible();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    expect(f.calls.at(-1)).toBe(0);
  });

  test(`${club ? "club" : "guest feed"}: failed visible-page refresh keeps confirmed rows and recovers`, async ({
    page,
  }) => {
    await page.clock.install();
    const f = await setup(page, club);
    await loadThrough(page, 36);
    await list(page).locator('[data-item-index="16"]').scrollIntoViewIfNeeded();
    await page.clock.runFor(200);
    f.edit(17);
    f.fail(12);
    await minute(page);
    await expect(page.getByText(/^PAGE_POST_17_v0 /).first()).toBeInViewport();
    await expect(list(page).locator(".ui-collection-item:visible")).toHaveCount(
      36,
    );
    f.fail();
    await minute(page);
    await expect(page.getByText(/^PAGE_POST_17_v1 /).first()).toBeInViewport();
  });
}

test("a club comment draft survives eviction of its page and return to the head", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00Z"));
  await setup(page, true, 144, true);
  const field = list(page).getByPlaceholder("Написать комментарий...").first();
  await field.fill("Несохранённый черновик комментария");
  await list(page).focus();
  await loadThrough(page, 120);
  await expect(list(page).locator(".ui-collection-item:visible")).toHaveCount(
    96,
  );
  await page.getByRole("button", { name: "Наверх", exact: true }).click();
  await expect(page.getByText(/^PAGE_POST_1_v0 /).first()).toBeVisible();
  await expect(
    list(page).getByPlaceholder("Написать комментарий...").first(),
  ).toHaveValue("Несохранённый черновик комментария");
});
