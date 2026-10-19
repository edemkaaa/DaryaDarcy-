import { expect, test, type Page } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { failure, ok } from "./editor-fixtures";

// Real profile/router/query state; only HTTP responses are synthetic.
const post = (id: number, text: string, target: "feed" | "club" | "both") => ({
  id,
  text,
  target,
  photos: [],
  media: [],
  tags: [],
  richText: null,
  source: "saved-access-fixture",
  status: "published",
  published: true,
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-01T12:00:00Z",
  publishedAt: "2026-10-01T12:00:00Z",
});
const openPost = post(42, "OPEN_SAVED_POST", "feed");
const bothPost = post(43, "BOTH_SAVED_POST", "both");
const clubPost = post(44, "CLOSED_SAVED_POST", "club");
type State = {
  access: boolean;
  role?: "user" | "moderator";
  guest?: boolean;
  subscriptionError?: boolean;
  savedError?: boolean;
  staleSavedSnapshot?: boolean;
};
async function fixture(page: Page, state: State) {
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.fallback()
      : route.abort(),
  );
  await layoutApi(page, true);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: state.guest
          ? null
          : {
              id: 101,
              openId: "saved-member",
              name: "Saved member",
              email: "saved@example.test",
              phone: null,
              gender: null,
              avatarUrl: null,
              loginMethod: "email",
              role: state.role ?? "user",
              lastSignedIn: "2026-10-01T12:00:00Z",
            },
      },
    }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    const inputs = JSON.parse(
      route.request().postData() ?? url.searchParams.get("input") ?? "{}",
    );
    const answers = names.map((name, index) => {
      if (name === "club.subscription")
        return state.subscriptionError
          ? failure(503)
          : ok({
              hasClubAccess: state.access,
              subscribed: state.access && state.role !== "moderator",
              expiresAt:
                state.access && state.role !== "moderator"
                  ? "2040-11-01T10:00:00Z"
                  : null,
              isOwner: false,
              cancelAtPeriodEnd: false,
              monthlyPrice: "790",
            });
      if (name === "feed.savedPosts")
        return state.savedError
          ? failure(503)
          : ok([
              openPost,
              bothPost,
              ...(state.access || state.staleSavedSnapshot ? [clubPost] : []),
            ]);
      if (name === "feed.getById") {
        const id = (
          url.searchParams.has("batch") ? inputs[index]?.json : inputs.json
        )?.id;
        return ok(
          id === 42
            ? openPost
            : id === 43
              ? bothPost
              : id === 44 && state.access
                ? clubPost
                : null,
        );
      }
      if (name === "feed.userInteractions")
        return ok({ likedIds: [], savedIds: [42, 43, 44] });
      if (name === "notifications.latest")
        return ok({ feedId: null, clubId: null });
      return ok([]);
    });
    await route.fulfill({
      json: url.searchParams.get("batch") === "1" ? answers : answers[0],
    });
  });
}
const card = (page: Page, text: string) =>
  page.getByRole("main").getByRole("button").filter({ hasText: text });

test("an unpaid member opens saved public posts without opening club-only content", async ({
  page,
}) => {
  await fixture(page, { access: false });
  await gotoWithSession(page, "/profile");
  await expect(card(page, "OPEN_SAVED_POST")).toBeVisible();
  await expect(card(page, "BOTH_SAVED_POST")).toBeVisible();
  await expect(
    page.getByText("У тебя нет активной подписки", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("public-saved.png") });
  await page.getByRole("button", { name: "Из клуба", exact: true }).click();
  await expect(card(page, "CLOSED_SAVED_POST")).toHaveCount(0);
  await expect(card(page, "BOTH_SAVED_POST")).toBeVisible();
  await expect(card(page, "OPEN_SAVED_POST")).toHaveCount(0);
  await page.getByRole("button", { name: "Из ленты", exact: true }).click();
  await card(page, "OPEN_SAVED_POST").click();
  await expect(page).toHaveURL(/\/post\/42$/);
  await expect(
    page.getByText("OPEN_SAVED_POST", { exact: true }),
  ).toBeVisible();
  await page.goto("/post/44");
  await expect(page.getByText("Пост не найден", { exact: true })).toBeVisible();
  await expect(page.getByText("CLOSED_SAVED_POST")).toHaveCount(0);
});

for (const role of ["user", "moderator"] as const) {
  test(`confirmed ${role} club access preserves saved club posts and the correct subscription state`, async ({
    page,
  }) => {
    await fixture(page, { access: true, role });
    await gotoWithSession(page, "/profile");
    await page.getByRole("button", { name: "Из клуба", exact: true }).click();
    await expect(card(page, "CLOSED_SAVED_POST")).toBeVisible();
    await expect(card(page, "BOTH_SAVED_POST")).toBeVisible();
    await expect(card(page, "OPEN_SAVED_POST")).toHaveCount(0);
    await expect(
      page.getByText(role === "moderator" ? "Служебный доступ" : "Активна", {
        exact: true,
      }),
    ).toBeVisible();
    if (role === "moderator")
      await expect(page.getByText("Активна", { exact: true })).toHaveCount(0);
  });
}

test("subscription lookup failure does not lock public bookmarks or claim an absent subscription", async ({
  page,
}) => {
  await fixture(page, {
    access: false,
    subscriptionError: true,
    staleSavedSnapshot: true,
  });
  await gotoWithSession(page, "/profile");
  await expect(card(page, "OPEN_SAVED_POST")).toBeVisible();
  await expect(
    page.getByText("Не удалось проверить подписку", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("У тебя нет активной подписки", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Из клуба", exact: true }).click();
  await expect(card(page, "CLOSED_SAVED_POST")).toHaveCount(0);
  await expect(card(page, "BOTH_SAVED_POST")).toBeVisible();
});

test("revoked access hides a retained club bookmark snapshot without hiding public ones", async ({
  page,
}) => {
  const state: State = { access: true, staleSavedSnapshot: true };
  await fixture(page, state);
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Из клуба", exact: true }).click();
  await expect(card(page, "CLOSED_SAVED_POST")).toBeVisible();
  state.access = false;
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("club.subscription"),
    ),
    page.evaluate(() => window.dispatchEvent(new Event("online"))),
  ]);
  await expect(
    page.getByText("У тебя нет активной подписки", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Из клуба", exact: true }).click();
  await expect(card(page, "CLOSED_SAVED_POST")).toHaveCount(0);
  await expect(card(page, "BOTH_SAVED_POST")).toBeVisible();
  await page.getByRole("button", { name: "Из ленты", exact: true }).click();
  await expect(card(page, "OPEN_SAVED_POST")).toBeVisible();
});

test("an unpaid member can retry a failed bookmarks read", async ({ page }) => {
  const state: State = { access: false, savedError: true };
  await fixture(page, state);
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByText("Не удалось загрузить сохранённые посты", { exact: true }),
  ).toBeVisible();
  state.savedError = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(card(page, "OPEN_SAVED_POST")).toBeVisible();
});

test("a guest still needs login before seeing saved posts", async ({
  page,
}) => {
  await fixture(page, { access: false, guest: true });
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByRole("button", { name: "Войти →", exact: true }),
  ).toBeVisible();
  await expect(card(page, "OPEN_SAVED_POST")).toHaveCount(0);
});
