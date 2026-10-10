import { expect, it } from "vitest";
import {
  expect as browserExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { COOKIE_NAME } from "../../packages/shared/src/const";

interface QuizBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  context: BrowserContext;
  frontend: string;
  connection: Pick<Connection, "query">;
  memberId: number;
}

async function completeCottagecoreQuiz(page: Page) {
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
}

export function registerQuizBrowserCases(fixture: () => QuizBrowserFixture) {
  it("C3 opens the quiz welcome instead of crashing when the saved result is absent or invalid", async () => {
    const { context, frontend } = fixture();
    await context.clearCookies();
    const page = await context.newPage();
    await page.goto(frontend + "quiz");
    for (const raw of [null, "{", '{"primaryKey":"unknown"}']) {
      await page.evaluate((value) => {
        const key = "darcy:user:guest:@darcy_quiz_result";
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }, raw);
      await page.goto(frontend + "quiz/result");
      await browserExpect(
        page.getByRole("button", { name: "Начать путешествие", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Пройти ещё раз", exact: true }),
      ).toHaveCount(0);
    }
  }, 30_000);
  it("C3 completes the guest quiz with a persisted result and restarts without reusing answers", async () => {
    const { rows, context, frontend } = fixture();
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (91401,91402) ORDER BY id";
    const before = await rows(identitySql);
    await context.clearCookies();
    const page = await context.newPage();
    await page.goto(frontend + "quiz");
    await completeCottagecoreQuiz(page);
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

  it("C3 shows the member quiz result in the profile after navigation and reload", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    const password = "Synthetic-C3-quiz-only-2026!";
    const email = "c3.quiz@example.test";
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      [email, await hashPassword(password), memberId],
    );
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?";
    const identity = await rows(identitySql, [memberId]);
    try {
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-quiz-access','paid','0','2030-01-01')",
        [memberId],
      );
      const payment = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await context.clearCookies();
      const page = await context.newPage();
      await page.goto(frontend + "login?next=/quiz");
      await page.getByPlaceholder("Email", { exact: true }).fill(email);
      await page.getByPlaceholder("Пароль", { exact: true }).fill(password);
      const [login] = await Promise.all([
        page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/auth/login",
        ),
        page.getByRole("button", { name: "Войти", exact: true }).click(),
      ]);
      expect(login.status()).toBe(200);
      expect((await login.json()).user).toMatchObject({ id: memberId, email });
      await browserExpect(page).toHaveURL(/\/quiz$/);
      await completeCottagecoreQuiz(page);
      // Catches a wrong owner key or a profile reader that drops the completed result.
      const stored = () =>
        page.evaluate((id) => {
          const raw = localStorage.getItem(
            `darcy:user:${id}:@darcy_quiz_result`,
          );
          return raw ? JSON.parse(raw) : null;
        }, memberId);
      await browserExpect
        .poll(stored)
        .toMatchObject({
          primaryKey: "cottagecore",
          scores: { cottagecore: 21 },
        });
      const completed = await stored();
      await page.goto(frontend + "profile");
      const result = page.getByText(
        "Девушка, вернувшая жизнь заброшенному саду",
        { exact: true },
      );
      await browserExpect(result).toBeVisible();
      await browserExpect(
        page.getByText("Пройди тест, чтобы узнать свою эстетику", {
          exact: true,
        }),
      ).toHaveCount(0);
      await page.reload();
      await browserExpect(result).toBeVisible();
      expect(await stored()).toEqual(completed);
      await page
        .getByRole("button", { name: /Посмотреть результат →/ })
        .click();
      await browserExpect(page).toHaveURL(/\/quiz\/result$/);
      await browserExpect(result).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Пройти ещё раз", exact: true }),
      ).toBeVisible();
      await page.reload();
      await browserExpect(result).toBeVisible();
      expect(await stored()).toEqual(completed);
      await page
        .getByRole("button", { name: "Пройти ещё раз", exact: true })
        .click();
      await browserExpect(
        page.getByRole("button", { name: "Начать путешествие", exact: true }),
      ).toBeVisible();
      // Retaking on the saved-result route must write a new completion, not retain read-only restore mode.
      await completeCottagecoreQuiz(page);
      await browserExpect
        .poll(async () => (await stored())?.completedAt)
        .not.toBe(completed.completedAt);
      const retaken = await stored();
      expect(retaken).toMatchObject({
        primaryKey: "cottagecore",
        scores: { cottagecore: 21 },
      });
      expect(Number.isNaN(Date.parse(retaken.completedAt))).toBe(false);
      await page.reload();
      await browserExpect(result).toBeVisible();
      expect(await stored()).toEqual(retaken);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(payment);
    } finally {
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-quiz-access'",
        [memberId],
      );
    }
  }, 30_000);

  it("C3 clears the completed quiz on logout and does not transfer it to the next account", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    const actorId = 91401;
    const password = "Synthetic-C3-quiz-switch-only-2026!";
    const passwordHash = await hashPassword(password);
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c3.quiz.member@example.test", passwordHash, memberId],
    );
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c3.quiz.admin@example.test", passwordHash, actorId],
    );
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (?,?) ORDER BY id";
    const identity = await rows(identitySql, [actorId, memberId]);
    try {
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-quiz-switch-access','paid','0','2030-01-01')",
        [memberId],
      );
      const payment = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await context.clearCookies();
      const page = await context.newPage();
      const signIn = async (email: string, id: number, next: string) => {
        await page.goto(frontend + `login?next=${next}`);
        await page.getByPlaceholder("Email", { exact: true }).fill(email);
        await page.getByPlaceholder("Пароль", { exact: true }).fill(password);
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/auth/login",
          ),
          page.getByRole("button", { name: "Войти", exact: true }).click(),
        ]);
        expect(response.status()).toBe(200);
        expect((await response.json()).user).toMatchObject({ id, email });
        await browserExpect(page).toHaveURL(frontend.slice(0, -1) + next);
      };
      await signIn("c3.quiz.member@example.test", memberId, "/quiz");
      await completeCottagecoreQuiz(page);
      const memberResult = () =>
        page.evaluate(
          (id) => localStorage.getItem(`darcy:user:${id}:@darcy_quiz_result`),
          memberId,
        );
      await browserExpect.poll(memberResult).not.toBeNull();
      await page.goto(frontend + "profile");
      const title = page.getByText(
        "Девушка, вернувшая жизнь заброшенному саду",
        { exact: true },
      );
      await browserExpect(title).toBeVisible();
      // Catches omitted previous-owner cleanup, even when separate keys hide the leak in UI.
      await page.getByRole("button", { name: "Выйти", exact: true }).click();
      await browserExpect
        .poll(
          async () =>
            (await context.cookies()).filter(
              (cookie) => cookie.name === COOKIE_NAME,
            ).length,
        )
        .toBe(0);
      await browserExpect.poll(memberResult).toBeNull();
      await signIn("c3.quiz.admin@example.test", actorId, "/profile");
      const empty = page.getByText("Пройди тест, чтобы узнать свою эстетику", {
        exact: true,
      });
      await browserExpect(empty).toBeVisible();
      await browserExpect(title).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          Object.keys(localStorage).filter((key) =>
            key.endsWith(":@darcy_quiz_result"),
          ),
        ),
      ).toEqual([]);
      await page.reload();
      await browserExpect(empty).toBeVisible();
      await browserExpect(title).toHaveCount(0);
      expect(await rows(identitySql, [actorId, memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(payment);
    } finally {
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-quiz-switch-access'",
        [memberId],
      );
    }
  }, 30_000);

  it("C3 does not assign an anonymous quiz result to the member who signs in next", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    const email = "c3.quiz.guest-transition@example.test";
    const password = "Synthetic-C3-guest-transition-only-2026!";
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      [email, await hashPassword(password), memberId],
    );
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?";
    const identity = await rows(identitySql, [memberId]);
    try {
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-quiz-guest-transition','paid','0','2030-01-01')",
        [memberId],
      );
      const payment = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await context.clearCookies();
      const page = await context.newPage();
      await page.goto(frontend + "quiz");
      await completeCottagecoreQuiz(page);
      const guestResult = () =>
        page.evaluate(() =>
          localStorage.getItem("darcy:user:guest:@darcy_quiz_result"),
        );
      await browserExpect.poll(guestResult).not.toBeNull();
      // Catches assigning unowned guest data to a newly authenticated person.
      await page.goto(frontend + "login?next=/profile");
      await page.getByPlaceholder("Email", { exact: true }).fill(email);
      await page.getByPlaceholder("Пароль", { exact: true }).fill(password);
      const [login] = await Promise.all([
        page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/auth/login",
        ),
        page.getByRole("button", { name: "Войти", exact: true }).click(),
      ]);
      expect(login.status()).toBe(200);
      expect((await login.json()).user).toMatchObject({ id: memberId, email });
      await browserExpect(page).toHaveURL(/\/profile$/);
      const empty = page.getByText("Пройди тест, чтобы узнать свою эстетику", {
        exact: true,
      });
      await browserExpect(empty).toBeVisible();
      await browserExpect(
        page.getByText("Девушка, вернувшая жизнь заброшенному саду", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(await guestResult()).toBeNull();
      expect(
        await page.evaluate(
          (id) => localStorage.getItem(`darcy:user:${id}:@darcy_quiz_result`),
          memberId,
        ),
      ).toBeNull();
      await page.reload();
      await browserExpect(empty).toBeVisible();
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(payment);
    } finally {
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-quiz-guest-transition'",
        [memberId],
      );
    }
  }, 30_000);
}
