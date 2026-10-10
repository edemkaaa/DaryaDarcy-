import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { RowDataPacket } from "mysql2/promise";

interface QuizBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  context: BrowserContext;
  frontend: string;
}

export function registerQuizBrowserCases(fixture: () => QuizBrowserFixture) {
  it("C3 completes the guest quiz with a persisted result and restarts without reusing answers", async () => {
    const { rows, context, frontend } = fixture();
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (91401,91402) ORDER BY id";
    const before = await rows(identitySql);
    await context.clearCookies();
    const page = await context.newPage();
    await page.goto(frontend + "quiz");
    await page
      .getByRole("button", { name: "Начать путешествие", exact: true })
      .click();
    // Hand-selected cottagecore answers: nine 2-point answers and a 3-point home.
    // Catches lost selections, wrong score/result persistence and stale restart state.
    const choices = [
      /Тёплое спокойствие/,
      "Выбрать изображение 1",
      "Выбрать изображение 1",
      "Выбрать изображение 1",
      "Выбрать изображение 1",
      "Испеку хлеб, соберу букет полевых цветов, повешу сушиться травы у окна",
      "Выбрать изображение 1",
      /Одну слезу/,
      "Приготовлю ужин из того, что выросло в саду, зажгу свечу и буду слушать камин",
      "Выбрать изображение 1",
    ];
    for (const [index, name] of choices.entries()) {
      const next = page.getByRole("button", {
        name: index === 9 ? "Узнать результат" : "Далее →",
        exact: true,
      });
      await browserExpect(next).toBeDisabled();
      const choice = page.getByRole("button", {
        name,
        exact: typeof name === "string",
      });
      await choice.click();
      await browserExpect(choice).toHaveAttribute("aria-pressed", "true");
      await browserExpect(next).toBeEnabled();
      await next.click();
    }
    await browserExpect(
      page.getByText("Девушка, вернувшая жизнь заброшенному саду", {
        exact: true,
      }),
    ).toBeVisible();
    await browserExpect(
      page.getByRole("button", { name: "Вступить в клуб", exact: true }),
    ).toBeVisible();
    const stored = () =>
      page.evaluate(() => {
        const value = localStorage.getItem(
          "darcy:user:guest:@darcy_quiz_result",
        );
        return value ? JSON.parse(value) : null;
      });
    await browserExpect.poll(stored).toMatchObject({
      primaryKey: "cottagecore",
      primaryTitle: "Девушка, вернувшая жизнь заброшенному саду",
      secondaryKey: null,
      isBlend: false,
      scores: {
        cottagecore: 21,
        goblincore: 0,
        witchcore: 0,
        castlecore: 0,
        fairycore: 0,
        darkAcademia: 0,
        lightAcademia: 0,
      },
    });
    const completed = await stored();
    expect(Number.isNaN(Date.parse(completed.completedAt))).toBe(false);
    await page
      .getByRole("button", { name: "Пройти ещё раз", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Начать путешествие", exact: true })
      .click();
    await browserExpect(
      page.getByRole("button", { name: "Далее →", exact: true }),
    ).toBeDisabled();
    await browserExpect(
      page.getByRole("button", { name: /Тёплое спокойствие/ }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(await stored()).toEqual(completed);
    await page.reload();
    await browserExpect(
      page.getByRole("button", { name: "Начать путешествие", exact: true }),
    ).toBeVisible();
    expect(await stored()).toEqual(completed);
    expect(await rows(identitySql)).toEqual(before);
  }, 30_000);
}
