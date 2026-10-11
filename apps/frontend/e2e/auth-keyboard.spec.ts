import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.use({ isMobile: true, hasTouch: true });

// These are keyboard geometry models, not a real iOS/Android keyboard.
async function resizeKeyboard(
  page: Page,
  model: "layout" | "visual",
  width: number,
  height: number,
) {
  if (model === "layout") await page.setViewportSize({ width, height });
  else
    await page.evaluate((height) => {
      Object.defineProperty(window.visualViewport!, "height", {
        configurable: true,
        value: height,
      });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    }, height);
  await expect
    .poll(() =>
      page.locator("#root").evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeCloseTo(height, 0);
}

async function fullyVisible(field: Locator) {
  await expect
    .poll(() =>
      field.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const scroll = el.closest(".ui-scroll")!.getBoundingClientRect();
        const viewport = window.visualViewport!;
        const top = Math.max(scroll.top, viewport.offsetTop);
        const bottom = Math.min(
          scroll.bottom,
          viewport.offsetTop + viewport.height,
        );
        return box.top >= top && box.bottom <= bottom;
      }),
    )
    .toBe(true);
}

for (const model of ["layout", "visual"] as const)
  for (const width of [320, 390])
    for (const mode of ["login", "register", "recover", "totp"] as const)
      test(`${mode} keeps its focused input visible with a ${model} keyboard at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await layoutApi(page);
        await gotoWithSession(page, "/login");
        if (mode === "register")
          await page
            .getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" })
            .click();
        if (mode === "recover")
          await page
            .getByRole("button", {
              name: "Забыли пароль или ещё не установили его?",
            })
            .click();
        if (mode === "totp") {
          await page.route("**/api/auth/login", (route) =>
            route.fulfill({
              status: 401,
              json: { error: "Введите код", requiresTotp: true },
            }),
          );
          await page
            .getByLabel("Email", { exact: true })
            .fill("member@example.test");
          await page
            .getByLabel("Пароль", { exact: true })
            .fill("Test-only-password");
          await page
            .getByRole("button", { name: "Войти", exact: true })
            .click();
        }
        const name =
          mode === "login"
            ? "Пароль"
            : mode === "totp"
              ? "Код двухфакторной аутентификации"
              : "Email";
        const field = page.getByLabel(name, { exact: true });
        const value =
          mode === "totp"
            ? "123456"
            : mode === "login"
              ? "Test-only-password"
              : "member@example.test";
        await field.fill(value);
        await field.focus();
        for (const height of [360, 260]) {
          await resizeKeyboard(page, model, width, height);
          // No test-side scrolling: the screen must reveal the focused field.
          await fullyVisible(field);
          await expect(field).toBeFocused();
          await expect(field).toHaveValue(value);
        }
        const submit = page.locator("main button[type=submit]");
        await submit.scrollIntoViewIfNeeded();
        await fullyVisible(submit);
        await resizeKeyboard(page, model, width, 844);
        await fullyVisible(field);
        await expect(field).toHaveValue(value);
        await expect(field).toBeFocused();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      });
