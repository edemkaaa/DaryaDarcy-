import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { editorApi, failure, ok } from "./editor-fixtures";

const post = (id: number, target = "feed") => ({
  id,
  text: `NOTICE_POST_${id}. ${"Публикация для проверки прокрутки. ".repeat(12)}`,
  photos: [],
  media: [],
  tags: [],
  richText: null,
  source: "",
  target,
  likeCount: 0,
  commentCount: 0,
  published: true,
  createdAt: "2026-10-01T12:00:00Z",
  publishedAt: "2026-10-01T12:00:00Z",
});
const notice = (page: Page) =>
  page.locator("[data-background-notice] [role=status]");
async function tick(page: Page) {
  await page.clock.fastForward(61_000);
  await page.clock.runFor(3_000);
}

for (const width of [320, 390, 1440, 1920]) {
  test(`background failures share a stable slot above navigation and controls (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    let fail = false;
    await editorApi(page, (name) =>
      name === "feed.listPaginated"
        ? fail
          ? failure(503)
          : ok({
              posts: Array.from({ length: 8 }, (_, i) => post(i + 1)),
              nextCursor: null,
            })
        : undefined,
    );
    await gotoWithSession(page, "/feed");
    const content = page.getByText(/^NOTICE_POST_1\./);
    await expect(content).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const scroll = page
      .locator("main .ui-scroll:not(.ui-scroll-horizontal)")
      .first();
    await scroll.evaluate((node) => {
      node.scrollTop = 400;
    });
    await page.clock.runFor(200);
    const before = await content.boundingBox();
    const top = await scroll.evaluate((node) => node.scrollTop);
    fail = true;
    await tick(page);
    await expect(notice(page)).toContainText("Не удалось обновить ленту");
    expect(await content.boundingBox()).toEqual(before);
    expect(await scroll.evaluate((node) => node.scrollTop)).toBe(top);
    const card = (await notice(page).boundingBox())!;
    const nav = (await page
      .getByRole("navigation", { name: "Разделы", exact: true })
      .boundingBox())!;
    expect(nav.y - card.y - card.height).toBeCloseTo(12, 0);
    expect(card.width).toBeLessThanOrEqual(456);
    expect(card.x).toBeGreaterThanOrEqual(12);
    for (const name of ["Наверх", "Новый пост", "Открыть админку"]) {
      const control = page.getByRole("button", { name, exact: true });
      await expect(control).toBeVisible();
      const box = (await control.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(card.y);
    }
    const node = (await notice(page).elementHandle())!;
    await tick(page);
    expect(await node.evaluate((element) => element.isConnected)).toBe(true);
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `/tmp/daryadarcy-notice-${width}.png` });
    // A session failure replaces the content message in the same slot.
    let sessionFails = true;
    await page.route("**/api/auth/me", (route) =>
      sessionFails ? route.abort("failed") : route.fallback(),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.clock.runFor(100);
    await expect(notice(page)).toContainText("Не удалось обновить сессию");
    await page.clock.runFor(200);
    const sessionCard = (await notice(page).boundingBox())!;
    expect(nav.y - sessionCard.y - sessionCard.height).toBeCloseTo(12, 0);
    if (width === 390)
      await page.screenshot({ path: "/tmp/daryadarcy-notice-session-390.png" });
    await expect(page.locator("[data-background-notice]")).toHaveCount(1);
    expect(await node.evaluate((element) => element.isConnected)).toBe(true);
    fail = false;
    sessionFails = false;
    // Hold the retry so its pending state and request coalescing are observable.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let pending = 0;
    await page.route("**/api/trpc/**", async (route) => {
      if (route.request().url().includes("feed.listPaginated")) {
        pending++;
        await held;
      }
      await route.fallback();
    });
    try {
      await notice(page)
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await page.clock.runFor(100);
      await expect.poll(() => pending).toBe(1);
      await expect(
        notice(page).getByRole("button", { name: "Проверяем…" }),
      ).toBeDisabled();
      expect(await content.boundingBox()).toEqual(before);
    } finally {
      release();
    }
    await expect(notice(page)).toHaveCount(0);
    expect(await content.boundingBox()).toEqual(before);
  });
}

test("profile keeps cached bookmarks and hides its warning after leaving", async ({
  page,
}) => {
  await page.clock.install();
  let fail = false;
  await layoutApi(page, true, (name) =>
    name === "feed.savedPosts"
      ? fail
        ? failure(503)
        : ok([post(1)])
      : undefined,
  );
  await gotoWithSession(page, "/profile");
  const bookmark = page.getByRole("button", {
    name: /^Открыть публикацию: NOTICE_POST_1/,
  });
  await expect(bookmark).toBeVisible();
  const node = (await bookmark.elementHandle())!;
  fail = true;
  await tick(page);
  await expect(notice(page)).toContainText(
    "Не удалось обновить сохранённые посты",
  );
  await expect(bookmark).toBeVisible();
  expect(await node.evaluate((element) => element.isConnected)).toBe(true);
  await page
    .getByRole("navigation", { name: "Разделы", exact: true })
    .getByRole("link", { name: "Библиотека" })
    .click();
  await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(notice(page)).toContainText(
    "Не удалось обновить сохранённые посты",
  );
  fail = false;
  await notice(page)
    .getByRole("button", { name: "Повторить", exact: true })
    .click();
  await page.clock.runFor(100);
  await expect(notice(page)).toHaveCount(0);
});

test("session, subscription and cached content failures have one recovery action", async ({
  page,
}) => {
  await page.clock.install();
  let fail = false;
  let subscriptionReads = 0;
  let savedReads = 0;
  let failedSavedReads = 0;
  await layoutApi(page, true, (name) => {
    if (name === "club.subscription") {
      subscriptionReads++;
      if (fail) return failure(503);
    }
    if (name === "feed.savedPosts") {
      savedReads++;
      if (fail) failedSavedReads++;
      return fail ? failure(503) : ok([post(1)]);
    }
  });
  await gotoWithSession(page, "/profile");
  const bookmark = page.getByRole("button", {
    name: /^Открыть публикацию: NOTICE_POST_1/,
  });
  await expect(bookmark).toBeVisible();
  fail = true;
  // React Query refetches on a connection transition, not a repeated online event.
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
  });
  await page.clock.runFor(3_000);
  await expect(notice(page)).toContainText("Не удалось обновить подписку");
  await tick(page);
  // Wait for the configured automatic retry before testing the recovery button.
  await expect
    .poll(async () => {
      await page.clock.runFor(1_500);
      return failedSavedReads;
    })
    .toBe(2);
  await page.clock.runFor(100);
  await expect(bookmark).toBeVisible();
  let sessionFails = true;
  await page.route("**/api/auth/me", (route) =>
    sessionFails ? route.abort("failed") : route.fallback(),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.clock.runFor(100);
  await expect(notice(page)).toContainText("Не удалось обновить сессию");
  await expect(page.locator("[data-background-notice]")).toHaveCount(1);
  const before = { subscriptionReads, savedReads };
  fail = false;
  sessionFails = false;
  await notice(page)
    .getByRole("button", { name: "Повторить", exact: true })
    .click();
  await page.clock.runFor(100);
  await expect(notice(page)).toHaveCount(0);
  expect(subscriptionReads).toBe(before.subscriptionReads + 1);
  expect(savedReads).toBe(before.savedReads + 1);
  await expect(bookmark).toBeVisible();
});

for (const width of [320, 390, 1440]) {
  test(`club warning follows the actual club navigation height and stays behind dialogs (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    let fail = false;
    await editorApi(page, (name) =>
      name === "club.listByCategory"
        ? fail
          ? failure(503)
          : ok({ posts: [post(1, "club")], nextCursor: null })
        : undefined,
    );
    await gotoWithSession(page, "/club");
    await expect(page.getByText(/^NOTICE_POST_1\./)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await page.getByText(/^NOTICE_POST_1\./).boundingBox();
    fail = true;
    await tick(page);
    await expect(notice(page)).toContainText(
      "Не удалось обновить публикации клуба",
    );
    expect(await page.getByText(/^NOTICE_POST_1\./).boundingBox()).toEqual(
      before,
    );
    const nav = (await page
      .getByRole("navigation", { name: "Разделы клуба" })
      .boundingBox())!;
    const card = (await notice(page).boundingBox())!;
    expect(nav.y - card.y - card.height).toBeCloseTo(12, 0);
    await page.getByRole("button", { name: "Новый пост", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await notice(page).evaluate((element) =>
        Boolean(element.closest("[inert]")),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    fail = false;
    await notice(page)
      .getByRole("button", { name: "Повторить", exact: true })
      .click();
    await page.clock.runFor(100);
    await expect(notice(page)).toHaveCount(0);
  });
}
