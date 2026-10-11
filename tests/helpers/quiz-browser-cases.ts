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
  base: string;
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
  it.each([
    {
      key: "lightAcademia",
      title: "Девушка, для которой красота – родной язык",
      first: /Радость и вдохновение/,
      images: [7, 7, 2, 7, 6, 7],
      morning:
        "Сяду на террасе кафе, буду рисовать прохожих и писать стихи на салфетке",
      sacrifice: /Ничего — найду другой путь/,
      evening: "Послушаю уличных музыкантов и усну с книгой стихов",
    },
    {
      key: "goblincore",
      title: "Девушка, чьи карманы полны лесных сокровищ",
      first: /Жгучее любопытство/,
      images: [3, 2, 3, 2, 3, 2],
      morning: "Пойду исследовать ручей, собирать камни и наблюдать за жабой",
      sacrifice: /Свой голос на один день/,
      evening:
        "Разложу все находки дня на мху и буду рисовать их в блокноте при свете светлячков",
    },
    {
      key: "witchcore",
      title: "Та, чьи руки пахнут травами и дождем",
      first: /Настороженную внимательность/,
      images: [2, 3, 5, 3, 5, 3],
      morning:
        "Пойду собирать травы на опушке, определяя каждую по запаху и форме листа",
      sacrifice: /Воспоминание о безмятежном дне/,
      evening:
        "Буду варить отвар из собранных трав при свете луны и гадать на пламени свечи",
    },
    {
      key: "castlecore",
      title: "Девушка, пишущая свою легенду от руки",
      first: /Торжественную тишину/,
      images: [6, 4, 4, 4, 2, 4],
      morning:
        "Поднимусь на самую высокую башню, чтобы увидеть всё королевство",
      sacrifice: /Свой страх — и почувствую/,
      evening:
        "Поднимусь на башню, зажгу свечи в канделябре и напишу письмо тому, кого ещё не встретила",
    },
    {
      key: "fairycore",
      title: "Танцующая босиком на рассвете",
      first: /Восторг и лёгкость/,
      images: [5, 5, 6, 5, 7, 5],
      morning:
        "Буду плести венок из росистых цветов и танцевать со светлячками",
      sacrifice: /Своё имя — и стану частью/,
      evening:
        "Заберусь на удобную ветку старого дуба и буду смотреть на звёзды. Буду подпевать кузнечикам и сверчкам",
    },
    {
      key: "darkAcademia",
      title: "Девушка, влюблённая в тишину старых библиотек",
      first: /Острое желание понять/,
      images: [4, 6, 7, 6, 4, 6],
      morning:
        "Сяду с книгой у окна, делая заметки на полях, потом буду бродить по городу",
      sacrifice: /Любимую книгу — в обмен/,
      evening:
        "Зажгу свечи и буду писать до рассвета — мысли текут, как никогда раньше",
    },
  ])(
    "C3 completes a pure $key quiz through literal choices and restores its result",
    async ({
      key,
      title: expectedTitle,
      first,
      images,
      morning,
      sacrifice,
      evening,
    }) => {
      const { rows, context, frontend } = fixture();
      const identitySql =
        "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (91401,91402) ORDER BY id";
      const identity = await rows(identitySql);
      await context.clearCookies();
      const page = await context.newPage();
      await page.goto(frontend + "quiz");
      await page
        .getByRole("button", { name: "Начать путешествие", exact: true })
        .click();
      const back = page.getByRole("button", { name: "← Назад", exact: true });
      await browserExpect(back).toBeDisabled();
      // Literal expected fixtures, independent of production QUESTIONS/scoring.
      // Landscape/companion/shelter order differs from the aesthetic order.
      const image = (index: number) => `Выбрать изображение ${index}`;
      const choices = [
        first,
        image(images[0]),
        image(images[1]),
        image(images[2]),
        image(images[3]),
        morning,
        image(images[4]),
        sacrifice,
        evening,
        image(images[5]),
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
        if (key === "lightAcademia" && index === 2) {
          // Revisit Q3 and Q2, replace the landscape, then restore it. Later
          // selections must survive navigation; the final score stays 21/0.
          const landscape = page.getByRole("button", {
            name: "Выбрать изображение 7",
            exact: true,
          });
          const alternate = page.getByRole("button", {
            name: "Выбрать изображение 1",
            exact: true,
          });
          await back.click();
          await browserExpect(landscape).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await back.click();
          await browserExpect(landscape).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await alternate.click();
          await browserExpect(landscape).toHaveAttribute(
            "aria-pressed",
            "false",
          );
          await browserExpect(alternate).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await next.click();
          await browserExpect(landscape).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await browserExpect(next).toBeEnabled();
          await back.click();
          await browserExpect(alternate).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await landscape.click();
          await browserExpect(alternate).toHaveAttribute(
            "aria-pressed",
            "false",
          );
          await next.click();
          await browserExpect(landscape).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await next.click();
        }
      }
      const title = page.getByText(expectedTitle, {
        exact: true,
      });
      await browserExpect(title).toBeVisible();
      const stored = () =>
        page.evaluate(() => {
          const raw = localStorage.getItem(
            "darcy:user:guest:@darcy_quiz_result",
          );
          return raw ? JSON.parse(raw) : null;
        });
      await browserExpect.poll(stored).toMatchObject({
        primaryKey: key,
        secondaryKey: null,
        isBlend: false,
        scores: {
          cottagecore: 0,
          goblincore: 0,
          witchcore: 0,
          castlecore: 0,
          fairycore: 0,
          darkAcademia: 0,
          lightAcademia: 0,
          [key]: 21,
        },
      });
      const saved = await stored();
      expect(Number.isNaN(Date.parse(saved.completedAt))).toBe(false);
      await page.goto(frontend + "quiz/result");
      await browserExpect(title).toBeVisible();
      await page.reload();
      await browserExpect(title).toBeVisible();
      expect(await stored()).toEqual(saved);
      expect(await rows(identitySql)).toEqual(identity);
    },
    30_000,
  );
  it.each([true, false])(
    "C3 isolates quiz ownership after a delayed native previous-session response (accepted login: %s)",
    async (accepted) => {
      const { rows, connection, context, frontend, base, memberId } = fixture();
      const password = "Synthetic-C3-concurrent-login-only-2026!";
      const email = "c3.concurrent-login@example.test";
      await connection.query(
        "UPDATE users SET email=?,passwordHash=? WHERE id=?",
        [email, await hashPassword(password), memberId],
      );
      const identitySql =
        "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (91401,91402) ORDER BY id";
      const before = await rows(identitySql);
      const paidBefore = await rows(
        "SELECT * FROM club_payments WHERE userId=?",
        [memberId],
      );
      const page = await context.newPage();
      // This guest key is cleared by the confirmed initial admin identity, not
      // by the initial owner=null setup. It avoids racing initial hydration.
      await page.addInitScript(() => {
        localStorage.setItem(
          "darcy:user:guest:@darcy_quiz_result",
          "initial-owner-marker",
        );
      });
      await page.goto(frontend + "login?next=/quiz");
      await browserExpect
        .poll(() =>
          page.evaluate(() =>
            localStorage.getItem("darcy:user:guest:@darcy_quiz_result"),
          ),
        )
        .toBeNull();
      await browserExpect(
        page.getByPlaceholder("Email", { exact: true }),
      ).toBeEnabled();
      const raw = (primaryKey: string) =>
        JSON.stringify({
          primaryKey,
          secondaryKey: null,
          isBlend: false,
          scores: {
            cottagecore: 0,
            goblincore: 0,
            witchcore: 0,
            castlecore: 0,
            fairycore: 0,
            darkAcademia: 0,
            lightAcademia: 0,
            [primaryKey]: 21,
          },
          completedAt: "2026-10-11T00:00:00.000Z",
        });
      const newRaw = raw("goblincore");
      const oldRaw = raw("cottagecore");
      await page.evaluate(
        ({ oldRaw, newRaw }) => {
          localStorage.setItem("darcy:user:91401:@darcy_quiz_result", oldRaw);
          localStorage.setItem("darcy:user:91402:@darcy_quiz_result", newRaw);
        },
        { oldRaw, newRaw },
      );
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let started = false,
        ready = false,
        finished = false;
      let transportError: unknown;
      await page.route(
        "**/api/auth/me",
        async (route) => {
          started = true;
          try {
            const response = await route.fetch({
              url: base + "/api/auth/me",
              maxRedirects: 0,
              timeout: 5000,
            });
            expect((await response.json()).user.id).toBe(91401);
            ready = true;
            await held;
            await route.fulfill({ response });
          } catch (error) {
            // Assert both sides of the held response; transport errors fail the
            // test instead of disappearing in an asynchronous route callback.
            transportError = error;
            ready = true;
          } finally {
            finished = true;
          }
        },
        { times: 1 },
      );
      try {
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await browserExpect.poll(() => ready).toBe(true);
        expect(transportError).toBeUndefined();
        await page.getByPlaceholder("Email", { exact: true }).fill(email);
        await page
          .getByPlaceholder("Пароль", { exact: true })
          .fill(accepted ? password : "Synthetic-wrong-password-only!");
        const [login] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/auth/login",
          ),
          page.getByRole("button", { name: "Войти", exact: true }).click(),
          page.waitForEvent("requestfailed", {
            predicate: (request) =>
              new URL(request.url()).pathname === "/api/auth/me" &&
              request.failure()?.errorText === "net::ERR_ABORTED",
          }),
        ]);
        expect(login.status()).toBe(accepted ? 200 : 401);
        if (accepted) {
          expect((await login.json()).user.id).toBe(memberId);
          await browserExpect(page).toHaveURL(/\/quiz$/);
        } else {
          expect(await login.json()).toMatchObject({
            error: "Неверный email или пароль",
          });
          await browserExpect(page).toHaveURL(/\/login$/);
          await browserExpect(
            page.getByText("Неверный email или пароль", { exact: true }),
          ).toBeVisible();
          await browserExpect(
            page.getByRole("button", { name: "Войти", exact: true }),
          ).toBeEnabled();
        }
        expect(
          await page.evaluate(() =>
            localStorage.getItem("darcy:user:91402:@darcy_quiz_result"),
          ),
        ).toBe(newRaw);
        release();
        await browserExpect.poll(() => finished).toBe(true);
        expect(transportError).toBeUndefined();
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        expect(
          await page.evaluate(() =>
            localStorage.getItem("darcy:user:91401:@darcy_quiz_result"),
          ),
        ).toBe(accepted ? null : oldRaw);
        expect(
          await page.evaluate(() =>
            localStorage.getItem("darcy:user:91402:@darcy_quiz_result"),
          ),
        ).toBe(newRaw);
        const current = await page.evaluate(async () =>
          (await fetch("/api/auth/me")).json(),
        );
        expect(current.user.id).toBe(accepted ? memberId : 91401);
        await page.goto(frontend + "quiz/result");
        await browserExpect(
          page.getByText(
            accepted
              ? "Девушка, чьи карманы полны лесных сокровищ"
              : "Девушка, вернувшая жизнь заброшенному саду",
            {
              exact: true,
            },
          ),
        ).toBeVisible();
        await browserExpect(
          page.getByText(
            accepted
              ? "Девушка, вернувшая жизнь заброшенному саду"
              : "Девушка, чьи карманы полны лесных сокровищ",
            {
              exact: true,
            },
          ),
        ).toHaveCount(0);
        expect(await rows(identitySql)).toEqual(before);
        expect(
          await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
        ).toEqual(paidBefore);
      } finally {
        release();
        if (started) await browserExpect.poll(() => finished).toBe(true);
      }
    },
    30_000,
  );
  it("C3 validates the profile quiz card with the same canonical result as the saved-result page", async () => {
    const { rows, context, frontend } = fixture();
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (91401,91402) ORDER BY id";
    const before = await rows(identitySql);
    const page = await context.newPage();
    await page.goto(frontend + "profile");
    const saved = {
      primaryKey: "cottagecore",
      primaryTitle: "Untrusted browser title",
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
      completedAt: "2026-10-10T00:00:00.000Z",
    };
    const setStored = (raw: string | null) =>
      page.evaluate((value) => {
        const key = "darcy:user:91401:@darcy_quiz_result";
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }, raw);
    const raw = JSON.stringify(saved);
    await setStored(raw);
    await page.reload();
    await browserExpect(
      page.getByText("Девушка, вернувшая жизнь заброшенному саду", {
        exact: true,
      }),
    ).toBeVisible();
    await browserExpect(
      page.getByText(saved.primaryTitle, { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /Посмотреть результат →/ }).click();
    await browserExpect(page).toHaveURL(/\/quiz\/result$/);
    await browserExpect(
      page.getByText("Девушка, вернувшая жизнь заброшенному саду", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("darcy:user:91401:@darcy_quiz_result"),
      ),
    ).toBe(raw);
    for (const invalid of [
      null,
      "{",
      JSON.stringify({ ...saved, primaryKey: "unknown" }),
      JSON.stringify({ ...saved, isBlend: true }),
    ]) {
      await setStored(invalid);
      await page.goto(frontend + "profile");
      await page.reload();
      await browserExpect(
        page.getByText("Пройди тест, чтобы узнать свою эстетику", {
          exact: true,
        }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: /Посмотреть результат →/ }),
      ).toHaveCount(0);
    }
    // A resume refresh of the same session must not re-write the restored completion.
    await setStored(raw);
    await page.goto(frontend + "quiz/result");
    const title = page.getByText("Девушка, вернувшая жизнь заброшенному саду", {
      exact: true,
    });
    await browserExpect(title).toBeVisible();
    const [current] = await Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/me",
      ),
      page.evaluate(() => window.dispatchEvent(new Event("focus"))),
    ]);
    expect(current.status()).toBe(200);
    expect((await current.json()).user).toMatchObject({ id: 91401 });
    await browserExpect(title).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("darcy:user:91401:@darcy_quiz_result"),
      ),
    ).toBe(raw);
    await context.clearCookies();
    // Online uses the same native session check without the resume-event cooldown.
    const [expired] = await Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/me",
      ),
      page.evaluate(() => window.dispatchEvent(new Event("online"))),
    ]);
    expect(expired.status()).toBe(200);
    expect(await expired.json()).toEqual({ user: null });
    await browserExpect(
      page.getByRole("button", { name: "Начать путешествие", exact: true }),
    ).toBeVisible();
    await browserExpect(title).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("darcy:user:91401:@darcy_quiz_result"),
      ),
    ).toBeNull();
    expect(await rows(identitySql)).toEqual(before);
  }, 30_000);
  it("C3 preserves both blend aesthetics when switching tabs and reopening the saved result", async () => {
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
    // Five cottagecore answers (10) followed by five goblincore answers (11 with home).
    const choices = [
      /Тёплое спокойствие/,
      "Выбрать изображение 1",
      "Выбрать изображение 1",
      "Выбрать изображение 1",
      "Выбрать изображение 1",
      "Пойду исследовать ручей, собирать камни и наблюдать за жабой",
      "Выбрать изображение 3",
      /Свой голос на один день/,
      "Разложу все находки дня на мху и буду рисовать их в блокноте при свете светлячков",
      "Выбрать изображение 2",
    ];
    for (const [index, name] of choices.entries()) {
      await page
        .getByRole("button", { name, exact: typeof name === "string" })
        .click();
      await page
        .getByRole("button", {
          name: index === 9 ? "Узнать результат" : "Далее →",
          exact: true,
        })
        .click();
    }
    const primary = page.getByText(
      "Девушка, чьи карманы полны лесных сокровищ",
      { exact: true },
    );
    const secondary = page.getByText(
      "Девушка, вернувшая жизнь заброшенному саду",
      { exact: true },
    );
    await browserExpect(primary).toBeVisible();
    const stored = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("darcy:user:guest:@darcy_quiz_result");
        return raw ? JSON.parse(raw) : null;
      });
    await browserExpect.poll(stored).toMatchObject({
      primaryKey: "goblincore",
      secondaryKey: "cottagecore",
      isBlend: true,
      scores: {
        cottagecore: 10,
        goblincore: 11,
        witchcore: 0,
        castlecore: 0,
        fairycore: 0,
        darkAcademia: 0,
        lightAcademia: 0,
      },
    });
    const completed = await stored();
    await page
      .getByRole("button", { name: "Cottagecore", exact: true })
      .click();
    await browserExpect(secondary).toBeVisible();
    await browserExpect(primary).toHaveCount(0);
    expect(await stored()).toEqual(completed);
    await page.getByRole("button", { name: "Goblincore", exact: true }).click();
    await browserExpect(primary).toBeVisible();
    await page.goto(frontend + "quiz/result");
    await browserExpect(primary).toBeVisible();
    await page
      .getByRole("button", { name: "Cottagecore", exact: true })
      .click();
    await browserExpect(secondary).toBeVisible();
    await page.reload();
    await browserExpect(primary).toBeVisible();
    expect(await stored()).toEqual(completed);
    expect(await rows(identitySql)).toEqual(before);
  }, 30_000);
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
      await browserExpect.poll(stored).toMatchObject({
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
      // Preserve staged scope while navigating with a real paid-member session.
      await browserExpect(
        page.getByText("Мои мудборды", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: /По подписке/ }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: /По приложению/ }),
      ).toBeVisible();
      const clubTab = page
        .getByRole("navigation", { name: "Разделы" })
        .getByRole("link", { name: "Клуб", exact: true });
      await clubTab.click();
      await browserExpect(page).toHaveURL(/\/club$/);
      await browserExpect(clubTab).toHaveAttribute("aria-current", "page");
      const setup = page.getByRole("dialog", {
        name: "Настройка профиля клуба",
      });
      await browserExpect(setup).toBeVisible();
      await setup
        .getByRole("button", { name: "Закрыть настройку профиля", exact: true })
        .click();
      await browserExpect(setup).toHaveCount(0);
      const community = page.getByRole("button", {
        name: "Комьюнити",
        exact: true,
      });
      await community.click();
      await browserExpect(community).toHaveAttribute("aria-pressed", "true");
      await browserExpect(
        page.getByText("Почтовое отделение — скоро", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: /найти друга по переписке/ }),
      ).toHaveCount(0);
      await page.goBack();
      await browserExpect(page).toHaveURL(/\/profile$/);
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
