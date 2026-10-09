import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test("statistics hide cached numbers after a failed refresh and recover on retry", async ({
  page,
}) => {
  const statistics = {
    totalPosts: 17,
    publishedPosts: 12,
    scheduledPosts: 3,
    draftPosts: 2,
    feedPosts: 9,
    clubPosts: 7,
    bothPosts: 1,
    totalLikes: 41,
    totalSaves: 8,
    postsThisMonth: 5,
    postsLastMonth: 4,
    topLikedPosts: [],
  };
  let unavailable = false;
  let recovered = false;
  await page.clock.setFixedTime(new Date("2026-10-10T00:00:00Z"));
  await editorApi(page, (name) => {
    if (name === "admin.stats")
      return unavailable
        ? failure(500)
        : ok({ ...statistics, totalPosts: recovered ? 18 : 17 });
  });
  await gotoWithSession(page, "/admin");
  const statsTab = page.getByRole("button", {
    name: "Статистика",
    exact: true,
  });
  await statsTab.click();
  await expect(page.getByText("17", { exact: true })).toBeVisible();

  // Remount the tab once its real query cache is stale; do not inject query state.
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page.clock.setFixedTime(new Date("2026-10-10T00:01:00Z"));
  unavailable = true;
  const failedRead = page.waitForResponse((response) =>
    new URL(response.url()).pathname.includes("admin.stats"),
  );
  await statsTab.click();
  await failedRead;
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Не удалось загрузить статистику",
  );
  await expect(page.getByText("17", { exact: true })).toHaveCount(0);
  await expect(page.getByText("PRIVATE_INTERNAL_DETAILS")).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("statistics-error.png"),
  });

  unavailable = false;
  recovered = true;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByText("18", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("statistics-recovered.png"),
  });
});

test("an unavailable initial read can recover to genuinely zero statistics", async ({
  page,
}) => {
  let unavailable = true;
  await editorApi(page, (name) => {
    if (name === "admin.stats")
      return unavailable
        ? failure(500)
        : ok({
            totalPosts: 0,
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
  });
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статистика", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Не удалось загрузить статистику",
  );
  await expect(page.getByText("Всего постов", { exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByText("Всего постов", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
