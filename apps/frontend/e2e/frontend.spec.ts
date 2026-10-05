import { test, expect, type Page } from "@playwright/test";
import { layoutApi } from "./layout-fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("@darcy_install_guide_seen", "1"),
  );
});

async function guestApi(page: Page) {
  await layoutApi(page);
}

for (const width of [320, 390, 1440]) {
  test(`public routes render without hydration errors at ${width}px`, async ({
    page,
  }) => {
    await guestApi(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|did not match|server rendered/i.test(message.text())
      )
        errors.push(message.text());
    });
    for (const path of [
      "/",
      "/feed",
      "/videos",
      "/club",
      "/interactive",
      "/library",
      "/shop",
      "/profile",
      "/login",
      "/quiz",
      "/legal",
      "/privacy",
      "/admin",
    ]) {
      const sessionChecked = page.waitForResponse((response) =>
        response.url().endsWith("/api/auth/me"),
      );
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      await sessionChecked;
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("#root")).toBeVisible();
      await expect.poll(() => page.locator("body").innerText()).not.toBe("");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path,
      ).toBe(true);
      expect(
        await page
          .locator("#root")
          .evaluate((element) => element.getBoundingClientRect().width),
        path,
      ).toBeLessThanOrEqual(480);
    }
    expect(errors).toEqual([]);
  });
}

test("registration requests an email instruction and stays signed out", async ({
  page,
}) => {
  await guestApi(page);
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/auth/register", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      json: {
        ok: true,
        message: "Проверьте почту: отправлена ссылка для установки пароля.",
      },
    });
  });
  await page.goto("/login?next=/admin");
  await page
    .getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" })
    .click();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Имя", exact: true })
    .fill("Тестовый пользователь");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("registration@example.test");
  await expect(
    page.getByRole("button", { name: "Получить письмо" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Получить письмо" }).click();
  await expect(page.getByRole("status")).toContainText(
    "ссылка для установки пароля",
  );
  expect(body).toMatchObject({
    email: "registration@example.test",
    name: "Тестовый пользователь",
    consentVersion: "2026-09-1",
  });
  expect(body).not.toHaveProperty("password");
  expect(page.url()).toContain("/login");
  expect(
    await page.evaluate(() => localStorage.getItem("app_session_token")),
  ).toBeNull();
});

test("disabled SMS stays hidden and a failed login offers an actionable error", async ({
  page,
}) => {
  await guestApi(page);
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Неверный email или пароль" },
    }),
  );
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Войти по телефону" }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("member@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Неверный email или пароль" }),
  ).toHaveText("Неверный email или пароль");
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeEnabled();
});

test("password recovery displays the server instruction", async ({ page }) => {
  await guestApi(page);
  await page.route("**/api/auth/password/request", (route) =>
    route.fulfill({
      status: 202,
      json: {
        ok: true,
        message: "Если аккаунт доступен, мы отправим письмо с инструкцией.",
      },
    }),
  );
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Забыли пароль или ещё не установили его?" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("member@example.test");
  await page.getByRole("button", { name: "Отправить инструкцию" }).click();
  await expect(page.getByRole("status")).toContainText("письмо с инструкцией");
});

test.describe("local development API", () => {
  test.skip(
    process.env.RUN_REAL_API_TESTS !== "1",
    "Requires prepared local MySQL and API on port 3000",
  );

  test("administrator signs in with an HttpOnly cookie and can open the editor", async ({
    page,
    context,
  }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/login\?next=\/admin$/);
    await page
      .getByLabel("Email", { exact: true })
      .fill("admin@daryadarcy.test");
    await page
      .getByLabel("Пароль", { exact: true })
      .fill(process.env.DEV_ADMIN_PASSWORD || "DarcyDev2026!");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("button", { name: /Новый/ })).toBeVisible();
    const cookie = (await context.cookies()).find(
      (cookie) => cookie.name === "app_session_id",
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(
      await page.evaluate(() => localStorage.getItem("app_session_token")),
    ).toBeNull();
    await page.reload();
    await page.getByRole("button", { name: /Новый/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("Проверка редактора без публикации");
    await expect(
      page.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toHaveValue("Проверка редактора без публикации");
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Вернуться в профиль" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect
      .poll(async () =>
        (await context.cookies()).some(
          (cookie) => cookie.name === "app_session_id",
        ),
      )
      .toBe(false);
    await page.goto("/admin");
    await expect(
      page.getByRole("button", { name: "Войти", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("darcy:logout-pending")),
    ).toBeNull();
    await page.reload();
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await page
      .getByLabel("Email", { exact: true })
      .fill("admin@daryadarcy.test");
    await page
      .getByLabel("Пароль", { exact: true })
      .fill(process.env.DEV_ADMIN_PASSWORD || "DarcyDev2026!");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("button", { name: /Новый/ })).toBeVisible();
  });

  test("a regular member does not receive administrator controls", async ({
    page,
  }) => {
    await page.goto("/login?next=/admin");
    await page
      .getByLabel("Email", { exact: true })
      .fill("member@daryadarcy.test");
    await page
      .getByLabel("Пароль", { exact: true })
      .fill(process.env.DEV_ADMIN_PASSWORD || "DarcyDev2026!");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("button", { name: "Войти", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Новый/ })).toHaveCount(0);
  });

  test("administrator creates, edits and deletes a draft through the real API", async ({
    page,
    context,
  }) => {
    await page.goto("/login?next=/admin");
    await page
      .getByLabel("Email", { exact: true })
      .fill("admin@daryadarcy.test");
    await page
      .getByLabel("Пароль", { exact: true })
      .fill(process.env.DEV_ADMIN_PASSWORD || "DarcyDev2026!");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const text = `Проверка переноса Next.js ${Date.now()}`;
    let createdId: number | undefined;
    try {
      await page.getByRole("button", { name: /Новый/ }).click();
      await page
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill(text);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Черновик", exact: true })
        .click();
      const created = page.waitForResponse(
        (response) =>
          response.url().includes("admin.createPost") &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      const response = await created;
      expect(response.status()).toBe(200);
      const body = await response.json();
      createdId = body[0].result.data.json;
      expect(typeof createdId).toBe("number");
      const card = page.getByTestId(`admin-post-${createdId}`);
      await expect(card).toContainText(text);
      await expect(card).toContainText("Черновик");
      await card.getByRole("button", { name: "Редактировать пост" }).click();
      await page
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill(`${text} — исправлен`);
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await expect(card).toContainText(`${text} — исправлен`);
      page.once("dialog", (dialog) => dialog.accept());
      await card.getByRole("button", { name: "Удалить пост" }).click();
      await expect(card).toHaveCount(0);
      createdId = undefined;
    } finally {
      // Clean up only the record created by this test, even if an assertion fails.
      if (createdId !== undefined) {
        const deleted = await context.request.post(
          "/api/trpc/admin.deletePost?batch=1",
          {
            headers: { Origin: "http://localhost:8081" },
            data: { "0": { json: { id: createdId } } },
          },
        );
        expect(deleted.ok()).toBe(true);
      }
    }
  });
});
