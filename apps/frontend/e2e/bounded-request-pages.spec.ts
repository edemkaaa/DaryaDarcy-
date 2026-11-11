import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const stamp = "2026-10-30T12:00:00Z";
/** Строим одиннадцать синтетических страниц для пяти списков: окно хранит максимум восемь, а удалённая предыдущая страница возвращается по исходному курсору с сохранением scroll-anchor. */
for (const mode of [
  "saved",
  "articles",
  "members",
  "payments",
  "posts",
] as const) {
  test(`${mode}: retains eight pages and reloads discarded data with the same cursor and scroll anchor`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const methods = {
      saved: "feed.savedPostsPage",
      articles: "admin.articlesPage",
      members: "admin.membersPage",
      payments: "admin.paymentsPage",
      posts: "admin.postsPage",
    };
    const previousLabels = {
      saved: "Предыдущие сохранённые",
      articles: "Предыдущие статьи",
      members: "Предыдущие участницы",
      payments: "Предыдущие оплаты",
      posts: "Предыдущие публикации",
    };
    const calls: (string | number | null)[] = [];
    let failPrevious = false;
    const crashes: string[] = [];
    page.on("pageerror", (error) => crashes.push(error.message));
    await editorApi(page, (name, input) => {
      if (name !== methods[mode]) return;
      const cursor = input.cursor as string | number | undefined;
      calls.push(cursor ?? null);
      const index =
        mode === "posts"
          ? Number(cursor ?? 0) / 20
          : cursor
            ? Number(String(cursor).split(":")[1])
            : 0;
      if (failPrevious && index === 2) return failure(503);
      const rows = Array.from({ length: 20 }, (_, i) => {
        const id = index * 20 + i + 1;
        const text = `WINDOW_${id}`;
        const common = {
          id,
          text,
          title: text,
          photos: [],
          tags: [],
          target: "feed",
          media: [],
          richText: null,
          likeCount: 0,
          commentCount: 0,
          published: true,
          status: "published",
          createdAt: stamp,
          updatedAt: stamp,
          publishedAt: stamp,
          scheduledAt: null,
        };
        if (mode === "articles")
          return { ...common, access: "club", coverUrl: null, sortOrder: id };
        if (mode === "members")
          return {
            id,
            name: text,
            email: `m${id}@example.test`,
            contactPhone: null,
            role: "user",
            createdAt: stamp,
            clubExpiresAt: null,
            blockedAt: null,
            blockedReason: null,
          };
        if (mode === "payments")
          return {
            id,
            userId: id,
            orderId: `order-${id}`,
            email: text,
            sum: "790.00",
            status: "paid",
            createdAt: stamp,
            updatedAt: stamp,
            paidAt: stamp,
            expiresAt: null,
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          };
        return mode === "posts"
          ? { ...common, tagCount: 0, hasVideo: false }
          : common;
      });
      const nextCursor =
        index < 10
          ? mode === "posts"
            ? (index + 1) * 20
            : `window:${index + 1}`
          : null;
      return ok(
        mode === "posts"
          ? { posts: rows, nextCursor }
          : { items: rows, nextCursor },
      );
    });
    await gotoWithSession(page, mode === "saved" ? "/profile" : "/admin");
    if (mode === "articles")
      await page.getByRole("button", { name: "Статьи", exact: true }).click();
    if (mode === "members")
      await page
        .getByRole("button", { name: "Участницы", exact: true })
        .click();
    if (mode === "payments")
      await page.getByRole("button", { name: "Оплаты", exact: true }).click();
    const titles = page
      .getByRole("main")
      .getByText(/^WINDOW_\d+$/, { exact: true });
    /** Догружаем настоящими действиями списка: кнопкой для сохранённого/участниц и прокруткой для остальных; считаем видимые строки на каждом шаге. */
    for (let index = 0; index <= 10; index++) {
      await expect(
        page.getByText(`WINDOW_${(index + 1) * 20}`, { exact: true }),
      ).toHaveCount(1);
      expect(await titles.count()).toBeLessThanOrEqual(160);
      if (index === 10) break;
      if (mode === "saved" || mode === "members")
        await page
          .getByRole("button", {
            name:
              mode === "saved"
                ? "Загрузить ещё сохранённые"
                : "Загрузить ещё участниц",
            exact: true,
          })
          .click();
      else
        await page
          .locator("main .ui-scroll:visible")
          .last()
          .evaluate((node) => {
            node.scrollTop = node.scrollHeight;
          });
    }
    await expect(titles).toHaveCount(160);
    await expect(page.getByText("WINDOW_1", { exact: true })).toHaveCount(0);
    /** Возврат за начало окна проверяем также через 503 и явный повтор: подтверждённые 160 строк должны оставаться до успеха. */
    const previous = page.getByRole("button", {
      name: previousLabels[mode],
      exact: true,
    });
    await previous.scrollIntoViewIfNeeded();
    const retained = page.getByText("WINDOW_61", { exact: true });
    let before = (await retained.boundingBox())!.y;
    // Opaque lists must retain the confirmed window if an earlier page fails.
    failPrevious = mode !== "posts";
    await previous.click();
    if (failPrevious) {
      await expect(
        page.getByText("Не удалось загрузить предыдущие записи", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(titles).toHaveCount(160);
      failPrevious = false;
      const retry = page.getByRole("button", {
        name: "Повторить",
        exact: true,
      });
      await retry.scrollIntoViewIfNeeded();
      before = (await retained.boundingBox())!.y;
      await retry.click();
    }
    await expect(page.getByText("WINDOW_41", { exact: true })).toHaveCount(1);
    await expect(titles).toHaveCount(160);
    expect(Math.abs((await retained.boundingBox())!.y - before)).toBeLessThan(
      3,
    );
    await expect(page.getByText("WINDOW_220", { exact: true })).toHaveCount(0);
    expect(calls.at(-1)).toBe(mode === "posts" ? 40 : "window:2");
    expect(crashes).toEqual([]);
  });
}
