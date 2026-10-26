import type { Page } from "@playwright/test";
import { cursorFixture, legacyCursorFixture } from "./cursor-fixture";
import { interactionFixture } from "./interaction-fixture";

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
export async function layoutApi(
  page: Page,
  subscribed = false,
  answer?: (name: string, input: Record<string, unknown>) => unknown,
) {
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
                gender: "female",
                email: "member@example.test",
                role: "user",
                avatarUrl: "https://example.test/avatar.jpg",
                lastSignedIn: "2026-10-01T12:00:00Z",
              }
            : null,
        },
      });
    }
    if (url.pathname === "/api/launch-config") {
      return route.fulfill({
        json: {
          revision: 0,
          season: "autumn",
          appearance: {
            startsOn: "09-01",
            backgroundUrl: null,
            bannerUrl: null,
          },
          managerEmail: "manager@example.test",
          orderMethod: "email-client",
          capabilities: {
            smsLogin: false,
            penPals: false,
            shopOnlinePayment: false,
            webPush: false,
          },
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
      const inputs = JSON.parse(url.searchParams.get("input") ?? "{}");
      const data = (name: string) => {
        switch (name) {
          case "club.subscription":
            return {
              hasClubAccess: subscribed,
              subscribed,
              expiresAt: subscribed ? "2040-11-01T10:00:00Z" : null,
              cancelAtPeriodEnd: false,
              cancellationStatus: "none",
              isOwner: false,
              monthlyPrice: "790",
            };
          case "club.claimPending":
            return { granted: false, orderId: null };
          case "feed.listPaginated":
            return { posts, nextCursor: null };
          case "admin.postsPage":
            return { posts: [], nextCursor: null };
          case "admin.articlesPage":
            return { items: [], nextCursor: null };
          case "admin.articleDetail":
            return null;
          case "admin.postCounts":
            return { total: 0, published: 0, scheduled: 0, draft: 0 };
          case "admin.postCalendar":
            return { days: [], upcoming: [] };
          case "club.listByCategory":
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
        json: procedures.map(
          (name, index) =>
            answer?.(name, inputs[index]?.json ?? {}) ??
            (name === "feed.interactionsForPosts"
              ? interactionFixture(
                  answer?.("feed.userInteractions", inputs[index]?.json ?? {}),
                  inputs[index]?.json ?? {},
                )
              : undefined) ??
            (legacyCursorFixture[name]
              ? cursorFixture(
                  answer?.(
                    legacyCursorFixture[name]!,
                    inputs[index]?.json ?? {},
                  ),
                  name,
                  inputs[index]?.json ?? {},
                )
              : undefined) ?? {
              result: { data: { json: data(name) } },
            },
        ),
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: "Unexpected fixture endpoint" },
    });
  });
}
