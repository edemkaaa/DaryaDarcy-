import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok, failure } from "./editor-fixtures";

const expiration = "2040-11-01T10:00:00Z";
async function fixture(
  page: Page,
  { role = "moderator", paid = false, owner = false, access = true } = {},
) {
  await layoutApi(page, true);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          openId: "club-access-member",
          name: "Участница",
          email: "member@example.test",
          role,
          lastSignedIn: "2026-10-01T12:00:00Z",
        },
      },
    }),
  );
  const state = { denied: false, access, paid, owner, cancelWrites: 0 };
  await page.route("**/api/trpc/**", (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    if (!names.includes("club.subscription") && !names.includes("club.cancel"))
      return route.fallback();
    const replies = names.map((name) => {
      if (name === "club.cancel") {
        state.cancelWrites++;
        return ok({ ok: true, expiresAt: expiration });
      }
      if (name === "club.subscription")
        return state.denied
          ? failure(403)
          : ok({
              hasClubAccess: state.access,
              subscribed: state.paid || state.owner,
              expiresAt: state.paid ? expiration : null,
              cancelAtPeriodEnd: false,
              cancellationStatus: "none",
              isOwner: state.owner,
              monthlyPrice: "790",
            });
      if (name === "feed.interactionsForPosts")
        return ok({ likedIds: [], savedIds: [] });
      if (name === "club.listByCategory" || name === "feed.listPaginated")
        return ok({ posts: [], nextCursor: null });
      return ok([]);
    });
    return route.fulfill({
      json: url.searchParams.has("batch") ? replies : replies[0],
    });
  });
  return state;
}

for (const width of [320, 390, 1440]) {
  test(`unpaid moderator enters the club without paid subscription controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await fixture(page);
    await gotoWithSession(page, "/club");
    await expect(
      page.getByRole("button", { name: "Комьюнити", exact: true }),
    ).toBeVisible();
    await page.goto("/profile");
    await expect(
      page.getByText("Служебный доступ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Клуб открыт для модерации. Оплаченной подписки нет.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Активна", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(/Следующее списание|Ежемесячная подписка/),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Отменить подписку", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Продлить клуб →", exact: true }),
    ).toHaveCount(0);
    expect(state.cancelWrites).toBe(0);
  });
}

for (const role of ["user", "moderator"]) {
  test(`paid ${role} sees the real period and cancellation`, async ({
    page,
  }) => {
    await fixture(page, { role, paid: true });
    await gotoWithSession(page, "/profile");
    await expect(page.getByText("Активна", { exact: true })).toBeVisible();
    await expect(page.getByText(/Следующее списание:.*2040/)).toBeVisible();
    await expect(
      page.getByText("Служебный доступ", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Отменить подписку", exact: true }),
    ).toBeVisible();
  });
}

test("a moderator role does not override a server refusal of club access", async ({
  page,
}) => {
  await fixture(page, { access: false });
  await gotoWithSession(page, "/club");
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Оплатить 790/ }).first(),
  ).toBeVisible();
});

test("owner keeps the existing access exception without a paid period", async ({
  page,
}) => {
  await fixture(page, { role: "admin", owner: true });
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByText("Профиль владелицы клуба, доступ без оплаты", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Служебный доступ", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Отменить подписку", exact: true }),
  ).toHaveCount(0);
});

test("a fresh permission refusal closes previously confirmed service access", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/club");
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toBeVisible();
  state.denied = true;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
  );
  await expect(
    page.getByText("Не удалось проверить подписку", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toHaveCount(0);
});
