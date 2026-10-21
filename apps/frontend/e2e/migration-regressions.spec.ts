import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const ok = (data: unknown) => ({ result: { data: { json: data } } });

async function mockContent(
  page: Page,
  answer: (name: string) => unknown,
  admin = false,
) {
  await layoutApi(page, admin);
  if (admin)
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: 101,
            openId: "migration-admin",
            name: "Тест",
            email: "admin@example.test",
            role: "admin",
            lastSignedIn: "2026-10-05T10:00:00Z",
          },
        },
      }),
    );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    const results = names.map((name) => {
      const custom = answer(name);
      if (custom !== undefined) return custom;
      if (name === "club.subscription")
        return ok({
          hasClubAccess: admin,
          subscribed: admin,
          monthlyPrice: "790",
          expiresAt: null,
          cancelAtPeriodEnd: false,
          cancellationStatus: "none",
          isOwner: admin,
        });
      if (name === "feed.listPaginated" || name === "club.list")
        return ok({ posts: [], nextCursor: null });
      if (name === "feed.userInteractions")
        return ok({ likedIds: [], savedIds: [] });
      return ok([]);
    });
    await route.fulfill({
      json: url.searchParams.get("batch") === "1" ? results : results[0],
    });
  });
}

test("a guest can open a public library article while club cards stay protected", async ({
  page,
}) => {
  await mockContent(page, (name) => {
    if (name === "articles.list")
      return ok([
        {
          id: 501,
          title: "Публичная статья",
          access: "public",
          coverUrl: "/assets/images/icon.png",
        },
        {
          id: 502,
          title: "Клубная статья",
          access: "club",
          coverUrl: "/assets/images/icon.png",
        },
      ]);
    if (name === "articles.getById")
      return ok({
        id: 501,
        title: "Публичная статья",
        locked: false,
        sections: [],
      });
  });
  await gotoWithSession(page, "/library");
  const publicCard = page
    .getByText("Публичная статья", { exact: true })
    .locator("..");
  await expect(publicCard).toContainText("Читать →");
  await expect(
    page.getByText("Клубная статья", { exact: true }).locator(".."),
  ).toContainText("Для участниц клуба Darcy →");
  await publicCard
    .getByRole("button", { name: "Читать →", exact: true })
    .click();
  await expect(page).toHaveURL(/\/library\/article\/501$/);
  await expect(
    page
      .getByText("Публичная статья", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Вступить в клуб", exact: true }),
  ).toHaveCount(0);
  await gotoWithSession(page, "/library");
  await page
    .getByText("Клубная статья", { exact: true })
    .locator("..")
    .getByRole("button", { name: "Для участниц клуба Darcy →", exact: true })
    .click();
  await expect(page).toHaveURL(/\/club$/);
});

test("a library API failure offers retry and restores articles after recovery", async ({
  page,
}) => {
  let failed = true;
  let calls = 0;
  await mockContent(page, (name) => {
    if (name !== "articles.list") return undefined;
    calls++;
    return failed
      ? {
          error: {
            json: {
              message: "Test failure",
              code: -32603,
              data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
            },
          },
        }
      : ok([{ id: 501, title: "Восстановленная статья", access: "public" }]);
  });
  await page.goto("/library", { waitUntil: "domcontentloaded" });
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить статьи библиотеки" });
  await expect(error).toBeVisible();
  const beforeRetry = calls;
  failed = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByText("Восстановленная статья", { exact: true }),
  ).toBeVisible();
  expect(calls).toBeGreaterThan(beforeRetry);
  await expect(error).toHaveCount(0);
});

test("the patterns aesthetic action opens the quiz", async ({ page }) => {
  await layoutApi(page);
  await gotoWithSession(page, "/library/patterns");
  await page
    .getByRole("button", { name: "Определить свою эстетику →" })
    .click();
  await expect(page).toHaveURL(/\/quiz$/);
});

test("checkout rejects executable URLs and keeps the guest on the club page", async ({
  page,
}) => {
  let calls = 0;
  await mockContent(page, (name) => {
    if (name === "club.createCheckout") {
      calls++;
      return ok({ url: "javascript:window.__unsafeCheckout=1;void(0)" });
    }
  });
  await page.goto("/club", { waitUntil: "domcontentloaded" });
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await page
    .getByRole("button", { name: /Оплатить 790/ })
    .first()
    .click();
  await expect(
    page
      .getByText("Не удалось открыть оплату: получен некорректный адрес.")
      .first(),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(page).toHaveURL(/\/club$/);
  expect(
    await page.evaluate(() => Reflect.get(window, "__unsafeCheckout")),
  ).toBeUndefined();
});

test("a valid HTTPS checkout still opens its payment destination", async ({
  page,
}) => {
  const destination = "https://payments.example.test/checkout/123";
  await mockContent(page, (name) =>
    name === "club.createCheckout"
      ? ok({ url: destination, user: null })
      : undefined,
  );
  await page.route(destination, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><html><head><meta charset="utf-8"></head><body><p>Тестовый экран оплаты</p></body></html>',
    }),
  );
  await page.goto("/club", { waitUntil: "domcontentloaded" });
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await page
    .getByRole("button", { name: /Оплатить 790/ })
    .first()
    .click();
  await expect(page).toHaveURL(destination);
  await expect(page.getByText("Тестовый экран оплаты")).toBeVisible();
});

test("club payment return flags update on the client without granting guest access", async ({
  page,
}) => {
  let claims = 0;
  await mockContent(page, (name) => {
    if (name === "club.claimPending") {
      claims++;
      return ok({ granted: false, orderId: null });
    }
  });
  const notice = page.getByText(
    "После оплаты проверьте почту: в письме будет инструкция для входа. Войдите, чтобы проверить доступ к клубу.",
    { exact: true },
  );
  await gotoWithSession(page, "/club?paid=0&paid=1");
  await expect(
    page.getByPlaceholder("Почта для чека и входа").first(),
  ).toBeVisible();
  await expect(notice).toHaveCount(0);
  await page.evaluate(() => window.history.pushState(null, "", "/club?paid=1"));
  await expect(notice).toBeVisible();
  expect(claims).toBe(0);
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toHaveCount(0);
  await page.evaluate(() => window.history.pushState(null, "", "/club"));
  await expect(notice).toHaveCount(0);
});

test("a subscribed member can open renewal and return to the club without reloading", async ({
  page,
}) => {
  await layoutApi(page, true);
  await gotoWithSession(page, "/club?checkout=1");
  await expect(
    page.getByRole("button", { name: /Оплатить 790/ }).first(),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Почта для чека и входа")).toHaveCount(0);
  await page.evaluate(() =>
    window.history.pushState(null, "", "/club?checkout=0&checkout=1"),
  );
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Оплатить 790/ })).toHaveCount(
    0,
  );
});

test("an authenticated payment return still asks the API before opening club access", async ({
  page,
}) => {
  let claims = 0;
  await mockContent(
    page,
    (name) => {
      if (name === "club.subscription")
        return ok({
          hasClubAccess: false,
          subscribed: false,
          monthlyPrice: "790",
          expiresAt: null,
          cancelAtPeriodEnd: false,
          cancellationStatus: "none",
          isOwner: false,
        });
      if (name === "club.claimPending") {
        claims++;
        return ok({ granted: false, orderId: null });
      }
    },
    true,
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          openId: "payment-return-member",
          name: "Участница",
          email: "member@example.test",
          role: "user",
          lastSignedIn: "2026-10-05T10:00:00Z",
        },
      },
    }),
  );
  await gotoWithSession(page, "/club?paid=1");
  await expect.poll(() => claims).toBe(1);
  await expect(
    page.getByText("Проверяем оплату… Доступ откроется после подтверждения.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toHaveCount(0);
  await page.evaluate(() => window.history.pushState(null, "", "/club"));
  await expect(
    page.getByText("Проверяем оплату… Доступ откроется после подтверждения.", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("a long locked article can scroll to its club action on a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await mockContent(page, (name) =>
    name === "articles.getById"
      ? ok({
          id: 502,
          title: "Длинное название закрытой статьи ".repeat(20),
          locked: true,
          coverUrl: "/assets/images/icon.png",
          sections: [],
        })
      : undefined,
  );
  await page.goto("/library/article/502", { waitUntil: "domcontentloaded" });
  const action = page.getByRole("button", {
    name: "Вступить в клуб",
    exact: true,
  });
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  await action.click();
  await expect(page).toHaveURL(/\/club$/);
});

test("nested dialogs isolate focus, close only the top window and restore the trigger", async ({
  page,
}) => {
  await mockContent(page, () => undefined, true);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/feed", { waitUntil: "domcontentloaded" });
  const trigger = page.getByRole("button", {
    name: "Новый пост",
    exact: true,
    includeHidden: true,
  });
  await trigger.click();
  const editor = page.getByRole("dialog", {
    name: "Редактор публикации",
    exact: true,
    includeHidden: true,
  });
  await expect(editor).toBeVisible();
  await expect
    .poll(() => trigger.evaluate((el) => Boolean(el.closest("[inert]"))))
    .toBe(true);
  const field = editor.getByPlaceholder("Текст поста… Enter — новый абзац");
  await field.fill("Текст для ссылки");
  await field.press("ControlOrMeta+a");
  await editor
    .getByRole("button", { name: "Добавить ссылку", exact: true })
    .click();
  const nested = page.getByRole("dialog", {
    name: "Ссылка в публикации",
    exact: true,
  });
  await expect(nested).toBeVisible();
  await expect(editor).toHaveAttribute("inert", "");
  await nested.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    nested.getByRole("button", { name: "Добавить", exact: true }),
  ).toBeFocused();
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press(index === 0 ? "Shift+Tab" : "Tab");
    await expect
      .poll(() => nested.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(nested).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(editor).not.toHaveAttribute("inert", "");
  await expect
    .poll(() => editor.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  await expect(field).toHaveValue("Текст для ссылки");
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => trigger.evaluate((el) => Boolean(el.closest("[inert]"))))
    .toBe(false);
});
