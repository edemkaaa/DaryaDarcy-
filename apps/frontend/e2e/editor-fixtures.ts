import type { Page, Route } from "@playwright/test";
import { layoutApi } from "./layout-fixtures";

export const ok = (data: unknown) => ({ result: { data: { json: data } } });
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
export async function editorApi(
  page: Page,
  answer?: (
    name: string,
    input: Record<string, unknown>,
    route: Route,
  ) => Promise<unknown> | unknown,
) {
  await layoutApi(page, true);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
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
        const custom = await answer?.(name, input, route);
        if (custom !== undefined) return custom;
        if (name === "feed.userInteractions")
          return ok({ likedIds: [], savedIds: [] });
        if (name === "feed.listPaginated" || name === "club.list")
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
