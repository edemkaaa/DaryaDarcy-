import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { editorApi, ok } from "./editor-fixtures";

for (const scenario of [
  {
    path: "/library",
    method: "articles.list",
    message: "Не удалось загрузить статьи библиотеки",
    valid: [],
  },
  {
    path: "/videos",
    method: "videos.list",
    message: "Не удалось загрузить видео",
    valid: [],
  },
  {
    path: "/feed",
    method: "feed.listPaginated",
    message: "Не удалось загрузить ленту",
    valid: { posts: [], nextCursor: null },
  },
] as const) {
  test(`${scenario.method}: malformed HTTP 200 shows retry and recovers to an empty list`, async ({
    page,
  }) => {
    let malformed = true;
    let reads = 0;
    const crashes: string[] = [];
    page.on("pageerror", (error) => crashes.push(error.message));
    await layoutApi(page, true, (name) => {
      if (name === scenario.method) {
        reads++;
        return ok(malformed ? [null] : scenario.valid);
      }
    });
    await gotoWithSession(page, scenario.path);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      scenario.message,
    );
    // Session confirmation can cancel and restart the initial public read.
    // The exact no-retry guarantee is checked at the real-client unit boundary.
    expect(reads).toBeGreaterThan(0);
    const beforeRetry = reads;
    malformed = false;
    await page.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    expect(reads).toBeGreaterThan(beforeRetry);
    expect(crashes).toEqual([]);
  });
}

test("article detail rejects malformed blocks and recovers without a render crash", async ({
  page,
}) => {
  let malformed = true;
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await layoutApi(page, true, (name) => {
    if (name === "articles.getById")
      return ok({
        id: 700,
        title: "Проверка структуры",
        coverUrl: null,
        access: "public",
        locked: false,
        sections: [
          {
            type: "text",
            text: malformed
              ? { private: "PRIVATE_PAYLOAD" }
              : "Проверенное содержимое",
          },
        ],
      });
  });
  await gotoWithSession(page, "/library/article/700");
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("PRIVATE_PAYLOAD")).toHaveCount(0);
  malformed = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByText("Проверенное содержимое", { exact: true }),
  ).toBeVisible();
  expect(crashes).toEqual([]);
});

test("statistics reject incompatible counters and calendar rejects invalid cards", async ({
  page,
}) => {
  let malformed = true;
  let statsReads = 0;
  let calendarReads = 0;
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await editorApi(page, (name) => {
    if (name === "admin.stats") {
      statsReads++;
      return ok({
        totalPosts: malformed ? "0" : 0,
        publishedPosts: 0,
        scheduledPosts: 0,
        draftPosts: 0,
        feedPosts: 0,
        clubPosts: 0,
        bothPosts: 0,
        totalLikes: 0,
        totalSaves: 0,
        postsThisMonth: 0,
        postsLastMonth: 0,
        topLikedPosts: [],
      });
    }
    if (name === "admin.postCalendar") {
      calendarReads++;
      return ok({ days: [], upcoming: malformed ? [null] : [] });
    }
  });
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статистика", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Не удалось загрузить статистику",
  );
  expect(statsReads).toBe(1);
  malformed = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByText("Всего постов", { exact: true })).toBeVisible();
  malformed = true;
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Не удалось загрузить календарь публикаций",
  );
  expect(calendarReads).toBe(1);
  malformed = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(calendarReads).toBe(2);
  expect(crashes).toEqual([]);
});
