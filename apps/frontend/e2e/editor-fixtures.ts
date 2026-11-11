import type { Page, Route } from "@playwright/test";
import { layoutApi } from "./layout-fixtures";
import { cursorFixture, legacyCursorFixture } from "./cursor-fixture";
import { interactionFixture } from "./interaction-fixture";

/** Формируем прежний tRPC JSON-конверт успешного синтетического ответа. */
export const ok = (data: unknown) => ({ result: { data: { json: data } } });
/** Отделяем безопасную бизнес-ошибку 400 от намеренно приватных деталей 5xx, которые UI обязан скрыть. */
export const failure = (status = 400) => ({
  error: {
    json: {
      message:
        status === 400
          ? "Тестовая ошибка сохранения"
          : "PRIVATE_INTERNAL_DETAILS",
      code: -32603,
      data: {
        code: status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
        httpStatus: status,
      },
    },
  },
});
/** Настраиваем полностью синтетический редактор: текущий администратор, включённые private-загрузки и контролируемые tRPC ответы. */
export async function editorApi(
  page: Page,
  answer?: (
    name: string,
    input: Record<string, unknown>,
    route: Route,
  ) => Promise<unknown> | unknown,
) {
  await layoutApi(page, true);
  // These editor fixtures explicitly model a release with private uploads on.
  // Availability/older-server/failure scenarios override this route themselves.
  await page.route("**/api/capabilities", (route) =>
    route.fulfill({
      json: {
        smsLogin: false,
        penPals: false,
        shopOnlinePayment: false,
        webPush: false,
        privateContentUploads: true,
        privatePostMediaUploads: true,
        privatePostVideoUploads: true,
      },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          profileRevision: 0,
          openId: "test-admin",
          name: "Тест",
          email: "test@example.test",
          role: "admin",
          lastSignedIn: "2026-10-04T10:00:00Z",
        },
      },
    }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    const encoded =
      route.request().postData() ?? url.searchParams.get("input") ?? "{}";
    const inputs = JSON.parse(encoded);
    const results = await Promise.all(
      names.map(async (name, index) => {
        const input = inputs[index]?.json ?? {};
        // A fresh read-only availability probe is not a recovery request for
        // an earlier fixture upload. Specific recovery handlers run below.
        if (
          [
            "admin.privateContentFileStatus",
            "admin.privateAttachmentStatus",
            "club.privateCommentPhotoStatus",
          ].includes(name) &&
          typeof input.idempotencyKey === "string" &&
          input.idempotencyKey.startsWith("availability:")
        )
          return ok({ state: "notRecorded" });
        const custom = await answer?.(name, input, route);
        if (custom !== undefined) return custom;
        if (name === "feed.interactionsForPosts")
          return interactionFixture(
            await answer?.("feed.userInteractions", input, route),
            input,
          );
        const legacy = legacyCursorFixture[name];
        if (legacy)
          return cursorFixture(
            await answer?.(legacy, input, route),
            name,
            input,
          );
        // Existing editor scenarios provide a full synthetic catalog. Serve the
        // new card/detail transport from that same fixture, not from production
        // repositories. Pagination itself is covered by native SQL + dedicated UI tests.
        if (name === "admin.articlesPage" || name === "admin.articleDetail") {
          const full = (await answer?.("admin.articles", input, route)) as
            | ReturnType<typeof ok>
            | undefined;
          const rows = full?.result?.data?.json;
          if (full !== undefined && !Array.isArray(rows)) return full;
          const catalog = (rows ?? []) as Record<string, unknown>[];
          if (name === "admin.articleDetail")
            return ok(
              catalog.find((row) => String(row.id) === String(input.id)) ??
                null,
            );
          const offset = Number(
            String(input.cursor ?? "article-fixture:0").split(":")[1],
          );
          const limit = Number(input.limit ?? 20);
          return ok({
            items: catalog.slice(offset, offset + limit).map((row) => ({
              id: row.id,
              title: row.title,
              coverUrl: row.coverUrl,
              access: row.access,
              published: row.published,
              sortOrder: row.sortOrder ?? 0,
              createdAt: row.createdAt ?? "2026-10-10T10:00:00Z",
              updatedAt: row.updatedAt ?? "2026-10-10T10:00:00Z",
            })),
            nextCursor:
              offset + limit < catalog.length
                ? `article-fixture:${offset + limit}`
                : null,
          });
        }
        if (name === "admin.postsPage" || name === "admin.postDetail") {
          const full = (await answer?.("admin.posts", input, route)) as
            | ReturnType<typeof ok>
            | undefined;
          const rows = full?.result?.data?.json;
          if (full !== undefined && !Array.isArray(rows)) return full;
          const catalog = (rows ?? []) as Record<string, unknown>[];
          if (name === "admin.postDetail")
            return ok(catalog.find((row) => row.id === input.id) ?? null);
          const offset = Number(input.cursor ?? 0),
            limit = Number(input.limit ?? 20);
          return ok({
            posts: catalog.slice(offset, offset + limit).map((row) => ({
              id: row.id,
              text: String(row.text ?? "").slice(0, 512),
              photos: ((row.photos as unknown[]) ?? []).slice(0, 1),
              tags: ((row.tags as unknown[]) ?? []).slice(0, 3),
              tagCount: ((row.tags as unknown[]) ?? []).length,
              hasVideo: ((row.media as { type: string }[]) ?? []).some(
                (media) => media.type === "video",
              ),
              published: row.published,
              status: row.status,
              target: row.target,
              scheduledAt: row.scheduledAt,
              publishedAt: row.publishedAt,
              createdAt: row.createdAt,
            })),
            nextCursor: catalog.length > offset + limit ? offset + limit : null,
          });
        }
        if (name === "admin.postCounts")
          return ok({ total: 0, published: 0, scheduled: 0, draft: 0 });
        if (name === "admin.postCalendar")
          return ok({ days: [], upcoming: [] });
        if (name === "feed.userInteractions")
          return ok({ likedIds: [], savedIds: [] });
        if (name === "feed.listPaginated" || name === "club.listByCategory")
          return ok({ posts: [], nextCursor: null });
        if (name === "admin.createPost" || name === "admin.createArticle")
          return ok(42);
        if (name === "admin.updatePost") return ok({ success: true });
        if (name === "admin.updateArticle") return ok({ ok: true });
        return ok([]);
      }),
    );
    await route
      .fulfill({
        json: url.searchParams.get("batch") === "1" ? results : results[0],
      })
      .catch(() => {});
  });
}
