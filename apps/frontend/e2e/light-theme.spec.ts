import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

/** Цвета проверяются по действующему светлому оформлению, а не по системной теме. */
async function expectLightDocument(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    "light",
  );
  const scheme = await page
    .locator("html")
    .evaluate((root) => getComputedStyle(root).colorScheme);
  expect(scheme.split(/\s+/).sort()).toEqual(["light", "only"]);
}

for (const systemScheme of ["light", "dark"] as const) {
  test(`quiz stays light with initial ${systemScheme} OS theme and live changes`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydrat|didn't match/i.test(message.text())
      )
        errors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: systemScheme });
    await layoutApi(page);
    await gotoWithSession(page, "/quiz");
    await page
      .getByRole("button", { name: "Начать путешествие", exact: true })
      .click();
    const next = page.getByRole("button", { name: "Далее →", exact: true });
    await expect(next).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    );
    if (process.env.F09_SCREENSHOTS) {
      await page.screenshot({
        path: `${process.env.F09_SCREENSHOTS}/quiz-${systemScheme}.png`,
      });
    }
    // This assertion catches the original mixed-palette bug before checking the new SSR markers.
    await expect(next).toHaveCSS("background-color", "rgb(238, 233, 224)");
    await expectLightDocument(page);
    await page.emulateMedia({
      colorScheme: systemScheme === "light" ? "dark" : "light",
    });
    await expect(next).toHaveCSS("background-color", "rgb(238, 233, 224)");
    await expectLightDocument(page);
    await page.getByRole("button", { name: /^Тёплое спокойствие/ }).click();
    await expect(next).toHaveCSS("background-color", "rgb(139, 115, 85)");
    await expect(next).toBeEnabled();
    await next.click();
    await expect(
      page.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
    ).toBeVisible();
    await page.emulateMedia({ colorScheme: "dark" });
    await expectLightDocument(page);
    await gotoWithSession(page, "/login");
    await expectLightDocument(page);
    expect(errors).toEqual([]);
  });
}

test("unknown route stays light outside the application theme provider", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  const response = await page.goto("/f09-unknown-route");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByText("Страница не найдена.", { exact: true }),
  ).toBeVisible();
  await expectLightDocument(page);
  expect(errors).toEqual([]);
});

test.describe("server document", () => {
  test.use({ javaScriptEnabled: false, colorScheme: "dark" });
  test("light scheme is declared before hydration", async ({ page }) => {
    await page.goto("/login");
    await expectLightDocument(page);
  });
});
