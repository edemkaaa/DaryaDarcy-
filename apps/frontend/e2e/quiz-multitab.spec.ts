import { expect, test, type Page } from "@playwright/test";
import { QUESTIONS } from "../src/domain/quiz/quiz-data";
import { serializeQuizProgress } from "../src/domain/quiz/quiz-progress";
import { join } from "node:path";
import { editorApi } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const progressKey = "darcy:user:101:@darcy_quiz_progress";
const resultKey = "darcy:user:101:@darcy_quiz_result";
/** Читаем durable-progress текущего аккаунта, чтобы сравнить байты до и после конфликта. */
const stored = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), progressKey);
/** Находим отдельное согласие принять сохранённое состояние вместо локального черновика. */
const continueSaved = (page: Page) =>
  page.getByRole("button", {
    name: "Продолжить сохранённый тест",
    exact: true,
  });
/** Первый вариант даёт различимый результат одновременной записи вкладок. */
const firstAnswer = (page: Page) =>
  page.getByRole("button", { name: /^Тёплое спокойствие/ });
/** Второй вариант позволяет определить победителя ревизии и восстановить его выбор в проигравшей вкладке. */
const secondAnswer = (page: Page) =>
  page.getByRole("button", { name: /^Жгучее любопытство/ });
const completedResult = {
  primaryKey: "cottagecore",
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
};

/** Открываем реальную quiz-страницу с одинаковой синтетической личностью для общей account-scoped записи. */
async function openQuiz(page: Page) {
  await editorApi(page);
  await gotoWithSession(page, "/quiz");
}
/** Начинаем новый проход через пользовательское действие и ждём первый вопрос. */
async function startQuiz(page: Page) {
  await openQuiz(page);
  await page
    .getByRole("button", { name: "Начать путешествие", exact: true })
    .click();
  await expect(firstAnswer(page)).toBeVisible();
}

/** Старый result-screen не может сбросить новый проход другой вкладки без явного принятия её состояния. */
test("an old result cannot restart over another tab's new progress", async ({
  page,
  context,
}) => {
  await openQuiz(page);
  await page.evaluate(
    ({ key, result }) => localStorage.setItem(key, JSON.stringify(result)),
    { key: resultKey, result: completedResult },
  );
  await gotoWithSession(page, "/quiz/result");
  const other = await context.newPage();
  await startQuiz(other);
  await firstAnswer(other).click();
  await other.getByRole("button", { name: "Далее →", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
  ).toBeVisible();
  const before = await stored(other);
  if (process.env.STAGE_ONE_SCREENSHOTS) {
    await expect(continueSaved(page)).toBeVisible();
    await page
      .getByRole("button", { name: "Пройти ещё раз", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(
        process.env.STAGE_ONE_SCREENSHOTS,
        "F20-quiz-restart-with-notice.png",
      ),
    });
  }
  await page
    .getByRole("button", { name: "Пройти ещё раз", exact: true })
    .click();
  await expect(continueSaved(page)).toBeVisible();
  expect(await stored(page)).toBe(before);
  await continueSaved(page).click();
  await expect(
    page.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
  ).toBeVisible();
  expect(await stored(page)).toBe(before);
  await other.reload();
  expect(JSON.parse((await stored(other))!).currentQuestion).toBe(1);
});

/** Одновременные ответы проверяем с Web Locks и резервной IndexedDB-координацией: остаётся одна целая ревизия, проигравший принимает её явно. */
for (const fallback of [false, true]) {
  test(`simultaneous answers preserve one complete revision (${fallback ? "IndexedDB" : "Web Locks"})`, async ({
    page,
    context,
  }) => {
    if (fallback)
      await context.addInitScript(() =>
        Object.defineProperty(navigator, "locks", { value: undefined }),
      );
    await startQuiz(page);
    const other = await context.newPage();
    await openQuiz(other);
    await expect(firstAnswer(other)).toBeVisible();
    await Promise.all([firstAnswer(page).click(), secondAnswer(other).click()]);
    await expect
      .poll(async () => JSON.parse((await stored(page))!).revision)
      .toBe(1);
    const winner = JSON.parse((await stored(page))!);
    expect(winner.answers[0]).toMatch(/^1[ab]$/);
    const loser = winner.answers[0] === "1a" ? other : page;
    await expect(continueSaved(loser)).toBeVisible();
    await continueSaved(loser).click();
    await expect(
      winner.answers[0] === "1a" ? firstAnswer(loser) : secondAnswer(loser),
    ).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse((await stored(page))!).revision).toBe(1);
  });
}

/** Завершение устаревшего прохода не должно заменить уже начатый новый run и его сохранённый результат. */
test("a stale last-question tab cannot finish or overwrite a newer run", async ({
  page,
  context,
}) => {
  await openQuiz(page);
  const old = serializeQuizProgress(
    {
      phase: "question",
      currentQuestion: QUESTIONS.length - 1,
      answers: QUESTIONS.map((q) => q.answers[0].id),
      result: null,
    },
    { runId: "11111111-1111-4111-8111-111111111111", revision: 10 },
  );
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: progressKey,
    value: old,
  });
  await page.reload();
  const other = await context.newPage();
  await openQuiz(other);
  await other
    .getByRole("button", { name: "Узнать результат", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Пройти ещё раз", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Начать путешествие", exact: true })
    .click();
  await secondAnswer(other).click();
  await expect(secondAnswer(other)).toHaveAttribute("aria-pressed", "true");
  const before = await stored(other);
  const resultBefore = await other.evaluate(
    (key) => localStorage.getItem(key),
    resultKey,
  );
  await page
    .getByRole("button", { name: "Узнать результат", exact: true })
    .click();
  await expect(continueSaved(page)).toBeVisible();
  expect(await stored(page)).toBe(before);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), resultKey),
  ).toBe(resultBefore);
});

test("a late answer from a stale tab cannot replace the newer question", async ({
  page,
  context,
}) => {
  await startQuiz(page);
  const other = await context.newPage();
  await openQuiz(other);
  await firstAnswer(other).click();
  await other.getByRole("button", { name: "Далее →", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
  ).toBeVisible();
  const before = await stored(other);
  await secondAnswer(page).click();
  await expect(continueSaved(page)).toBeVisible();
  expect(await stored(page)).toBe(before);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
  ).toBeVisible();
});

/** Legacy-progress повышает версию только при явном ответе; уже выбранные ответы сохраняются. */
test("legacy progress upgrades on the next explicit answer without losing earlier answers", async ({
  page,
}) => {
  await openQuiz(page);
  const legacy = serializeQuizProgress({
    phase: "question",
    currentQuestion: 1,
    answers: QUESTIONS.map((q, index) =>
      index === 0 ? q.answers[0].id : null,
    ),
    result: null,
  });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: progressKey,
    value: legacy,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Выбрать изображение 1", exact: true })
    .click();
  await expect
    .poll(async () => JSON.parse((await stored(page))!).version)
    .toBe(2);
  const progress = JSON.parse((await stored(page))!);
  expect(progress.answers.slice(0, 2)).toEqual([
    QUESTIONS[0].answers[0].id,
    QUESTIONS[1].answers[0].id,
  ]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
