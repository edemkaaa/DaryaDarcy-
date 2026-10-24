import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

type Role = "user" | "admin" | "moderator" | "manager";
function actor(role: Role) {
  return {
    id: 101,
    openId: "routing-fixture",
    name: "Проверка маршрутов",
    email: "routing@example.test",
    role,
    lastSignedIn: "2026-10-09T00:00:00Z",
  };
}
async function fixtures(
  page: Page,
  role: Role | null = null,
  subscribed = false,
) {
  await layoutApi(page, subscribed);
  let user = role ? actor(role) : null;
  const staffRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/api\/trpc\/(?:admin|moderation)\./.test(path))
      staffRequests.push(path);
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user } }),
  );
  await page.route("**/api/auth/login", (route) => {
    expect(route.request().method()).toBe("POST");
    user = actor(role ?? "user");
    return route.fulfill({ json: { user } });
  });
  return { staffRequests };
}
async function enter(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("routing@example.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("Synthetic-test-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
}

test("guest admin entry uses a clean login and retains its destination across reload", async ({
  page,
}) => {
  const { staffRequests } = await fixtures(page);
  await gotoWithSession(page, "/admin");
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
  await enter(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByText("Недостаточно прав для управления приложением", {
      exact: true,
    }),
  ).toBeVisible();
  expect(staffRequests).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Вернуться в профиль", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
});

for (const role of ["user", "manager", "admin", "moderator"] as const) {
  test(`${role} receives only its allowed admin interface`, async ({
    page,
  }) => {
    const { staffRequests } = await fixtures(page, role);
    await gotoWithSession(page, "/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByText(
        role === "admin"
          ? "Админка"
          : role === "moderator"
            ? "Модерация"
            : "Недостаточно прав для управления приложением",
        { exact: true },
      ),
    ).toBeVisible();
    if (role === "user" || role === "manager") {
      expect(staffRequests).toEqual([]);
      await expect(
        page.getByRole("button", { name: "Войти", exact: true }),
      ).toHaveCount(0);
    } else if (role === "moderator") {
      expect(staffRequests.some((path) => path.includes("admin."))).toBe(false);
      await expect(
        page.getByRole("button", { name: "Участницы", exact: true }),
      ).toHaveCount(0);
    } else
      await expect(
        page.getByRole("button", { name: /^Новый пост$/ }),
      ).toBeVisible();
  });
}

test("a failed session check does not redirect or request staff data", async ({
  page,
}) => {
  const { staffRequests } = await fixtures(page);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: { error: "Synthetic error" } }),
  );
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  expect(staffRequests).toEqual([]);
});

test("a legacy login link is cleaned and still returns an administrator correctly", async ({
  page,
}) => {
  await fixtures(page, "admin");
  await gotoWithSession(page, "/login?next=/admin&token=private#secret");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
  ).not.toMatch(/private|secret/);
  await enter(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Админка", exact: true }),
  ).toBeVisible();
});

test("an unsafe legacy return falls back to the profile", async ({ page }) => {
  await fixtures(page);
  await gotoWithSession(
    page,
    "/login?next=https%3A%2F%2Fother.example%2Fadmin",
  );
  await expect(page).toHaveURL(/\/login$/);
  await enter(page);
  await expect(page).toHaveURL(/\/profile$/);
});

test("profile entry uses a clean login and consumes its return after success", async ({
  page,
}) => {
  await fixtures(page);
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Войти →", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await enter(page);
  await expect(page).toHaveURL(/\/profile$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("darcy:login-return:v1")),
  ).toBeNull();
});

test("login destinations remain independent between two tabs", async ({
  page,
  context,
}) => {
  await fixtures(page);
  await gotoWithSession(page, "/admin");
  await expect(page).toHaveURL(/\/login$/);
  const other = await context.newPage();
  await fixtures(other);
  await gotoWithSession(other, "/login?next=/feed");
  await expect(other).toHaveURL(/\/login$/);
  await enter(other);
  await expect(other).toHaveURL(/\/feed$/);
  await enter(page);
  await expect(page).toHaveURL(/\/admin$/);
});

test("a post save entry returns to that exact post after login", async ({
  page,
}) => {
  await fixtures(page);
  await page.route("**/api/trpc/**", (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    if (!names.includes("feed.getById")) return route.fallback();
    const results = names.map((name) => ({
      result: {
        data: {
          json:
            name === "feed.getById"
              ? {
                  id: 123,
                  text: "EXACT_POST_RETURN",
                  target: "feed",
                  photos: [],
                  tags: [],
                  media: [],
                  richText: null,
                  likeCount: 0,
                  createdAt: "2026-10-01T12:00:00Z",
                }
              : [],
        },
      },
    }));
    return route.fulfill({
      json: url.searchParams.get("batch") === "1" ? results : results[0],
    });
  });
  await gotoWithSession(page, "/post/123");
  await page
    .getByRole("button", { name: "Сохранить пост", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await enter(page);
  await expect(page).toHaveURL(/\/post\/123$/);
  await expect(
    page.getByText("EXACT_POST_RETURN", { exact: true }),
  ).toBeVisible();
});

test("renewal uses a clean club URL, survives reload and does not affect normal club entry", async ({
  page,
}) => {
  await fixtures(page, "user", true);
  await gotoWithSession(page, "/profile");
  await page
    .getByRole("button", { name: "Продлить клуб →", exact: true })
    .click();
  await expect(page).toHaveURL(/\/club$/);
  await expect(
    page
      .getByRole("button", { name: /Оплатить 790|Открыть тестовую оплату/ })
      .first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: /Оплатить 790|Открыть тестовую оплату/ })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Лента", exact: true })
    .click();
  await expect(page).toHaveURL(/\/feed$/);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Клуб", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Оплатить 790|Открыть тестовую оплату/ }),
  ).toHaveCount(0);
});
