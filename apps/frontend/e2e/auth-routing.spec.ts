import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok } from "./editor-fixtures";

type Role = "user" | "admin" | "moderator" | "manager";
/** Создаём одну синтетическую личность с изменяемой ролью, отделяя доступ к интерфейсу от настоящих полномочий сервера. */
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
/** Перехватываем сессию и вход и считаем staff-запросы: отказ интерфейса не должен предварительно читать административные данные. */
async function fixtures(
  page: Page,
  role: Role | null = null,
  subscribed = false,
  answer?: Parameters<typeof layoutApi>[2],
) {
  await layoutApi(page, subscribed, answer);
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
/** Проходим реальную форму входа с тестовыми credentials, не подменяя состояние провайдера напрямую. */
async function enter(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("routing@example.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("Synthetic-test-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
}

/** Прямой вход гостя в /admin сохраняет проверенное назначение после reload, затем обычный пользователь получает отказ без staff-запросов. */
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

/** Каждая роль видит только свой экран: manager не наследует admin, moderator не запрашивает admin-процедуры. */
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

/** Временный сбой сессии оставляет возможность повтора на исходном URL, а не превращает посетителя в гостя. */
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

/** Старый next переносится в безопасное состояние, а лишние query/fragment-секреты не попадают в sessionStorage. */
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

/** Внешний return-target отвергается и после входа используется безопасный профиль. */
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

/** Назначение возврата после успешного входа расходуется один раз. */
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

/** Две вкладки сохраняют собственные назначения входа и не перезаписывают друг друга. */
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

/** Гостевые сохранение и лайк возвращают к числовому или UUID-посту после reload входа, не выполняя действие автоматически. */
for (const publicId of [undefined, "c22db58f-698b-41ea-8e12-524d8323b034"]) {
  for (const action of ["Сохранить пост", "Нравится"]) {
    const address = publicId ?? "123";
    test(`${action}: login reload returns to post ${address}`, async ({
      page,
    }) => {
      const mutations: string[] = [];
      await fixtures(page, null, false, (name) => {
        if (name === "feed.toggleLike" || name === "feed.toggleSave")
          mutations.push(name);
        if (name === "feed.getById")
          return ok({
            id: 123,
            ...(publicId ? { publicId } : {}),
            text: "EXACT_POST_RETURN",
            target: "feed",
            photos: [],
            tags: [],
            media: [],
            richText: null,
            likeCount: 0,
            commentCount: 0,
            createdAt: "2026-10-01T12:00:00Z",
            publishedAt: null,
          });
      });
      await gotoWithSession(page, `/post/${address}`);
      await expect(
        page.getByText("EXACT_POST_RETURN", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.reload();
      await enter(page);
      await expect(page).toHaveURL(new RegExp(`/post/${address}$`));
      await expect(
        page.getByText("EXACT_POST_RETURN", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem("darcy:login-return:v1"),
        ),
      ).toBeNull();
      expect(mutations).toEqual([]);
    });
  }
}

/** Намерение продления переживает reload текущей истории, но не переносится на последующий обычный вход в клуб. */
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
