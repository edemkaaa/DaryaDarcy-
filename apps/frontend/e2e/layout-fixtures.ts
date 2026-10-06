import type { Page } from "@playwright/test";

/** Wait for client startup before interacting with server-rendered controls. */
export async function gotoWithSession(page: Page, path: string) {
  const [, response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/me" &&
        response.status() === 200,
    ),
    page.goto(path, { waitUntil: "domcontentloaded" }),
  ]);
  return response;
}

/** Browser-only data: layout checks must not start an API or write to a database. */
export async function layoutApi(page: Page, subscribed = false) {
  await page.addInitScript(() => {
    localStorage.setItem("@darcy_install_guide_seen", "1");
    localStorage.setItem(
      "darcy:user:101:@darcy_club_profile_completed",
      "true",
    );
  });
  const posts = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    text: "Проверка длинной публикации и прокрутки содержимого.\n".repeat(6),
    photos: [],
    tags: [],
    media: [],
    richText: null,
    target: "feed",
    likeCount: 0,
    commentCount: 0,
    createdAt: "2026-10-01T12:00:00Z",
    publishedAt: "2026-10-01T12:00:00Z",
  }));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({
        json: {
          user: subscribed
            ? {
                id: 101,
                openId: "layout-member",
                name: "Участница",
                email: "member@example.test",
                role: "user",
                avatarUrl: "https://example.test/avatar.jpg",
                lastSignedIn: "2026-10-01T12:00:00Z",
              }
            : null,
        },
      });
    }
    if (url.pathname === "/api/capabilities") {
      return route.fulfill({
        json: {
          smsLogin: false,
          penPals: false,
          shopOnlinePayment: false,
          webPush: false,
        },
      });
    }
    if (url.pathname.startsWith("/api/trpc/")) {
      const procedures = decodeURIComponent(
        url.pathname.slice("/api/trpc/".length),
      ).split(",");
      const data = (name: string) => {
        switch (name) {
          case "club.subscription":
            return {
              subscribed,
              expiresAt: null,
              cancelAtPeriodEnd: false,
              isOwner: false,
              monthlyPrice: "790",
            };
          case "feed.listPaginated":
            return { posts, nextCursor: null };
          case "club.list":
            return {
              posts: posts.map((post) => ({ ...post, target: "club" })),
              nextCursor: null,
            };
          case "feed.userInteractions":
            return { likedIds: [], savedIds: [] };
          default:
            return [];
        }
      };
      return route.fulfill({
        json: procedures.map((name) => ({
          result: { data: { json: data(name) } },
        })),
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: "Unexpected fixture endpoint" },
    });
  });
}
