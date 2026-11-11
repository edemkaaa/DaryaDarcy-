import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const beforeTitle = "ARTICLE_BEFORE";
const afterTitle = "ARTICLE_AFTER";
const readsToRefresh = [
  "admin.postsPage",
  "admin.postCounts",
  "admin.postCalendar",
  "admin.stats",
];

/** Связываем статью, её клубную карточку, счётчики, календарь и статистику одним синтетическим состоянием; отдельно моделируем отказ и потерю ACK. */
async function fixture(page: Page, existing: boolean) {
  await page.clock.setFixedTime(new Date("2026-10-10T12:00:00Z"));
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.fallback()
      : route.abort(),
  );
  page.on("dialog", (dialog) => dialog.accept());
  const state = {
    title: existing ? beforeTitle : (null as string | null),
    reads: new Map<string, number>(),
    writes: 0,
    reject: false,
    loseResponse: false,
  };
  await editorApi(page, (name, input) => {
    if (readsToRefresh.includes(name))
      state.reads.set(name, (state.reads.get(name) ?? 0) + 1);
    const count = state.title ? 2 : 1;
    /** Строим минимальную карточку того же опубликованного материала для всех административных проекций. */
    const card = (id: number, text: string) => ({
      id,
      text,
      photos: [],
      tags: [],
      tagCount: 0,
      hasVideo: false,
      published: true,
      status: "published",
      target: "club",
      scheduledAt: null,
      publishedAt: "2026-10-10T10:00:00Z",
      createdAt: "2026-10-10T10:00:00Z",
    });
    if (name === "admin.postsPage")
      return ok({
        posts: [
          card(1, "BASE_POST"),
          ...(state.title ? [card(700, state.title)] : []),
        ],
        nextCursor: null,
      });
    if (name === "admin.postCounts")
      return ok({ total: count, published: count, scheduled: 0, draft: 0 });
    if (name === "admin.postCalendar")
      return ok({
        days: [
          {
            ...card(1, "BASE_POST"),
            dayIndex: 9,
            total: count,
            published: count,
            scheduled: 0,
            draft: 0,
          },
        ],
        upcoming: [],
      });
    if (name === "admin.stats")
      return ok({
        totalPosts: count,
        publishedPosts: count,
        scheduledPosts: 0,
        draftPosts: 0,
        feedPosts: 0,
        clubPosts: count,
        bothPosts: 0,
        totalLikes: 0,
        totalSaves: 0,
        postsThisMonth: count,
        postsLastMonth: 0,
        topLikedPosts: [],
      });
    if (name === "admin.articles")
      return ok(
        state.title
          ? [
              {
                id: 700,
                title: state.title,
                coverUrl: null,
                access: "club",
                published: true,
                sections: [{ type: "text", text: "Содержимое статьи" }],
              },
            ]
          : [],
      );
    if (
      [
        "admin.createArticle",
        "admin.updateArticle",
        "admin.deleteArticle",
      ].includes(name)
    ) {
      state.writes++;
      if (state.reject) return failure(400);
      state.title = name === "admin.deleteArticle" ? null : String(input.title);
      if (state.loseResponse) return failure(500);
      return ok(name === "admin.createArticle" ? 700 : { ok: true });
    }
    if (name === "admin.articleCreationStatus")
      return ok({ status: "created", articleId: 700 });
  });
  return state;
}

/** Находим именованное действие или раздел админки без зависимости от CSS-хешей. */
const tab = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
/** Выбираем контейнер общего счётчика, чтобы проверить одновременно число и подпись. */
const total = (page: Page) =>
  page.getByText("Всего", { exact: true }).locator("..");

/** Сначала заполняем все проверяемые QueryClient-проекции; после mutation их нельзя принять за новый результат без чтения. */
async function primeCache(page: Page, count: number) {
  await gotoWithSession(page, "/admin");
  await expect(page.getByTestId("admin-post-1")).toBeVisible();
  await expect(total(page)).toHaveText(new RegExp(`^${count}\\s*Всего$`));
  await tab(page, "Календарь").click();
  await expect(
    page.getByText(`${count} опубл. · 0 отложено · 0 черновик`, {
      exact: true,
    }),
  ).toBeVisible();
  await tab(page, "Статистика").click();
  await expect(
    page.getByText("Всего постов", { exact: true }).locator(".."),
  ).toHaveText(new RegExp(`${count}\\s*Всего постов`));
  await tab(page, "Статьи").click();
  await expect(tab(page, "Написать статью")).toBeVisible();
}

/** Создание, правка, удаление и восстановление потерянного ACK должны обновить все зависимые проекции после подтверждения. */
for (const action of ["create", "edit", "delete", "recover"] as const) {
  test(`confirmed article ${action} refreshes fresh admin pages, counts, calendar and statistics`, async ({
    page,
  }) => {
    const state = await fixture(page, action === "edit" || action === "delete");
    await primeCache(page, state.title ? 2 : 1);
    const before = new Map(state.reads);
    if (action === "delete") {
      await tab(page, "Удалить").click();
      await expect(page.getByText(beforeTitle, { exact: true })).toHaveCount(0);
    } else {
      await tab(
        page,
        action === "edit" ? "Править" : "Написать статью",
      ).click();
      await page.getByPlaceholder("Что посмотреть осенью...").fill(afterTitle);
      state.loseResponse = action === "recover";
      await tab(page, action === "edit" ? "Сохранить" : "Опубликовать").click();
      if (action === "recover") {
        await expect(
          page
            .locator("[data-background-notice] [role=status]")
            .filter({ hasText: "Результат сохранения не подтверждён" }),
        ).toBeVisible();
        expect(state.reads.get("admin.postCounts")).toBe(
          before.get("admin.postCounts"),
        );
        await tab(page, "Проверить сохранение").click();
      }
      await expect(tab(page, "Написать статью")).toBeVisible();
    }
    const count = action === "delete" ? 1 : 2;
    await expect
      .poll(() => state.reads.get("admin.postCounts") ?? 0)
      .toBeGreaterThan(before.get("admin.postCounts")!);
    await expect(total(page)).toHaveText(new RegExp(`^${count}\\s*Всего$`));
    await tab(page, "Посты").click();
    await expect
      .poll(() => state.reads.get("admin.postsPage") ?? 0)
      .toBeGreaterThan(before.get("admin.postsPage")!);
    if (action === "delete")
      await expect(page.getByTestId("admin-post-700")).toHaveCount(0);
    else
      await expect(page.getByTestId("admin-post-700")).toContainText(
        afterTitle,
      );
    await tab(page, "Календарь").click();
    await expect
      .poll(() => state.reads.get("admin.postCalendar") ?? 0)
      .toBeGreaterThan(before.get("admin.postCalendar")!);
    await expect(
      page.getByText(`${count} опубл. · 0 отложено · 0 черновик`, {
        exact: true,
      }),
    ).toBeVisible();
    await tab(page, "Статистика").click();
    await expect
      .poll(() => state.reads.get("admin.stats") ?? 0)
      .toBeGreaterThan(before.get("admin.stats")!);
    await expect(
      page.getByText("Всего постов", { exact: true }).locator(".."),
    ).toHaveText(new RegExp(`${count}\\s*Всего постов`));
    expect(state.writes).toBe(1);
  });
}

/** Определённый отказ сохраняет ввод и подтверждённый кэш, не вызывая успешную инвалидацию. */
test("a rejected article edit does not invalidate confirmed admin data", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await primeCache(page, 2);
  const before = new Map(state.reads);
  state.reject = true;
  await tab(page, "Править").click();
  await page.getByPlaceholder("Что посмотреть осенью...").fill(afterTitle);
  await tab(page, "Сохранить").click();
  await expect.poll(() => state.writes).toBe(1);
  await expect(tab(page, "Сохранить")).toBeEnabled();
  await expect(page.getByPlaceholder("Что посмотреть осенью...")).toHaveValue(
    afterTitle,
  );
  await tab(page, "Посты").click();
  await expect(page.getByTestId("admin-post-700")).toContainText(beforeTitle);
  await tab(page, "Календарь").click();
  await expect(
    page.getByText("2 опубл. · 0 отложено · 0 черновик", { exact: true }),
  ).toBeVisible();
  await tab(page, "Статистика").click();
  await expect(page.getByText("Всего постов", { exact: true })).toBeVisible();
  expect(state.reads).toEqual(before);
});
