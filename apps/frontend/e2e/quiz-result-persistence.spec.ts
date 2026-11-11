import { expect, test, type Page } from "@playwright/test";
import { serializeQuizProgress } from "../src/domain/quiz/quiz-progress";
import { editorApi } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const runId = "11111111-1111-4111-8111-111111111111";
const title = "Девушка, вернувшая жизнь заброшенному саду";
const answers = ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a"];
const scores = {
  cottagecore: 21,
  goblincore: 0,
  witchcore: 0,
  castlecore: 0,
  fairycore: 0,
  darkAcademia: 0,
  lightAcademia: 0,
};
type StorageOperation = { kind: "set" | "remove"; key: string; value?: string };
type TraceWindow = typeof window & {
  quizStorageOperations: StorageOperation[];
  quizResultWriteAttempts: number;
  blockQuizResultWrites: boolean;
};

/** Разделяем гостевые и пользовательские ключи, переключаем Web Locks/IndexedDB и наблюдаем порядок storage-записей, не заменяя алгоритм завершения теста. */
async function fixture(
  page: Page,
  owner: "guest" | "member",
  fallback = false,
) {
  const keys = {
    progress: `darcy:user:${owner === "guest" ? "guest" : 101}:@darcy_quiz_progress`,
    result: `darcy:user:${owner === "guest" ? "guest" : 101}:@darcy_quiz_result`,
  };
  await editorApi(page);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user:
          owner === "guest"
            ? null
            : {
                id: 101,
                openId: "quiz-member",
                name: "Участница",
                email: "quiz@example.test",
                role: "user",
                profileRevision: 0,
                lastSignedIn: "2026-11-01T00:00:00Z",
              },
      },
    }),
  );
  await page.route("https://**", (route) => route.abort());
  await page.addInitScript(
    ({ keys, fallback }) => {
      if (fallback)
        Object.defineProperty(navigator, "locks", {
          configurable: true,
          value: undefined,
        });
      const trace = window as TraceWindow;
      trace.quizStorageOperations = [];
      trace.quizResultWriteAttempts = 0;
      trace.blockQuizResultWrites = false;
      const set = Storage.prototype.setItem;
      const remove = Storage.prototype.removeItem;
      /** Фиксируем только quiz-result/progress текущего владельца; управляемый отказ результата происходит до native-записи. */
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === keys.result) {
          trace.quizResultWriteAttempts++;
          if (trace.blockQuizResultWrites)
            throw new DOMException(
              "Controlled quota failure",
              "QuotaExceededError",
            );
        }
        set.call(this, key, value);
        if (
          this === localStorage &&
          (key === keys.result || key === keys.progress)
        )
          trace.quizStorageOperations.push({ kind: "set", key, value });
      };
      /** Записываем удаление progress после успешного native-remove, чтобы сравнить фактический порядок операций. */
      Storage.prototype.removeItem = function (key) {
        remove.call(this, key);
        if (
          this === localStorage &&
          (key === keys.result || key === keys.progress)
        )
          trace.quizStorageOperations.push({ kind: "remove", key });
      };
    },
    { keys, fallback },
  );
  await gotoWithSession(page, "/quiz");
  return keys;
}

/** Готовим последний вопрос через существующий сериализатор, сохраняя различие legacy и versioned run. */
async function lastQuestion(page: Page, key: string, legacy = false) {
  const raw = serializeQuizProgress(
    {
      phase: "question",
      currentQuestion: 9,
      answers,
      result: null,
    },
    legacy ? undefined : { runId, revision: 20 },
  );
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key,
    raw,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Узнать результат", exact: true }),
  ).toBeEnabled();
  return raw;
}

/** Дожидаемся результата и двух animation-frame, прежде чем проверять отсутствие лишнего writer из passive effects. */
async function resultVisible(page: Page) {
  await expect(
    page.getByText(title, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  // Let the result view's passive effects run before checking for extra writes.
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
}

/** Читаем журнал успешных storage-операций текущей страницы. */
const operations = (page: Page) =>
  page.evaluate(() => (window as TraceWindow).quizStorageOperations);
/** Сравниваем сохранённое значение побайтно, не принимая повторную эквивалентную запись за отсутствие записи. */
const rawResult = (page: Page, key: string) =>
  page.evaluate((key) => localStorage.getItem(key), key);

/** В двух схемах блокировки и для гостя/участницы двойная активация завершает run один раз: сначала result, затем удаление progress. */
for (const owner of ["guest", "member"] as const) {
  for (const fallback of [false, true]) {
    test(`${owner}: stores exactly once before removing progress (${fallback ? "IndexedDB" : "Web Locks"})`, async ({
      page,
    }) => {
      const keys = await fixture(page, owner, fallback);
      await lastQuestion(page, keys.progress);
      // Two immediate activations must still publish one completed run.
      await page
        .getByRole("button", { name: "Узнать результат", exact: true })
        .evaluate((button: HTMLButtonElement) => {
          button.click();
          button.click();
        });
      await resultVisible(page);
      const trace = await operations(page);
      expect(trace.map(({ kind, key }) => ({ kind, key }))).toEqual([
        { kind: "set", key: keys.result },
        { kind: "remove", key: keys.progress },
      ]);
      const raw = (await rawResult(page, keys.result))!;
      const result = JSON.parse(raw);
      expect(result).toMatchObject({
        runId,
        primaryKey: "cottagecore",
        primaryTitle: title,
        secondaryKey: null,
        isBlend: false,
        scores,
      });
      expect(Number.isNaN(Date.parse(result.completedAt))).toBe(false);
      expect(await rawResult(page, keys.progress)).toBeNull();
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

      await gotoWithSession(page, "/quiz/result");
      await resultVisible(page);
      expect(await rawResult(page, keys.result)).toBe(raw);
      expect(await operations(page)).toEqual([]);
      await page.reload();
      await resultVisible(page);
      expect(await rawResult(page, keys.result)).toBe(raw);
      expect(await operations(page)).toEqual([]);

      if (owner === "member") {
        await gotoWithSession(page, "/profile");
        await expect(page.getByText(title, { exact: true })).toBeVisible();
        await page
          .getByRole("button", { name: /Посмотреть результат →/ })
          .click();
        await expect(page).toHaveURL(/\/quiz\/result$/);
        await resultVisible(page);
        expect(await rawResult(page, keys.result)).toBe(raw);
        expect(await operations(page)).toEqual([]);
      }
    });
  }
}

/** Legacy-завершение не выдумывает отсутствующий runId и не добавляет второго writer. */
test("legacy progress completes without inventing run metadata or duplicating the write", async ({
  page,
}) => {
  const keys = await fixture(page, "member");
  await lastQuestion(page, keys.progress, true);
  await page
    .getByRole("button", { name: "Узнать результат", exact: true })
    .click();
  await resultVisible(page);
  const result = JSON.parse((await rawResult(page, keys.result))!);
  expect(result).toMatchObject({
    primaryKey: "cottagecore",
    primaryTitle: title,
    scores,
  });
  expect(result).not.toHaveProperty("runId");
  expect(
    (await operations(page)).filter(
      ({ kind, key }) => kind === "set" && key === keys.result,
    ),
  ).toHaveLength(1);
});

/** При отказе обязательной записи сохраняются прежний result и ответы; новый вычисленный результат остаётся в памяти с предупреждением. */
test("a failed required write retains the old result and recoverable answers without a second writer", async ({
  page,
}) => {
  const keys = await fixture(page, "member");
  const progress = await lastQuestion(page, keys.progress);
  const previous = JSON.stringify({
    primaryKey: "cottagecore",
    primaryTitle: title,
    secondaryKey: null,
    isBlend: false,
    scores,
    completedAt: "2026-10-01T00:00:00.000Z",
  });
  await page.evaluate(
    ({ key, previous }) => {
      localStorage.setItem(key, previous);
      const trace = window as TraceWindow;
      trace.quizStorageOperations = [];
      trace.quizResultWriteAttempts = 0;
      trace.blockQuizResultWrites = true;
    },
    { key: keys.result, previous },
  );
  await page
    .getByRole("button", { name: "Узнать результат", exact: true })
    .click();
  await resultVisible(page);
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Прогресс теста не сохранён на устройстве" }),
  ).toBeVisible();
  expect(await rawResult(page, keys.progress)).toBe(progress);
  expect(await rawResult(page, keys.result)).toBe(previous);
  expect(
    await page.evaluate(() => (window as TraceWindow).quizResultWriteAttempts),
  ).toBe(1);
  expect(await operations(page)).toEqual([]);
});

/** Проходим десять реальных вопросов, затем проверяем новый runId и пустые ответы после явного повторного старта. */
test("a complete guest journey saves once and restarting creates a new run", async ({
  page,
}) => {
  const keys = await fixture(page, "guest");
  await page
    .getByRole("button", { name: "Начать путешествие", exact: true })
    .click();
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
  await resultVisible(page);
  const completed = JSON.parse((await rawResult(page, keys.result))!);
  expect(completed).toMatchObject({
    primaryKey: "cottagecore",
    primaryTitle: title,
    scores,
  });
  expect(completed.runId).toMatch(/^[a-z0-9-]{36}$/);
  expect(
    (await operations(page)).filter(
      ({ kind, key }) => kind === "set" && key === keys.result,
    ),
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "Пройти ещё раз", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Начать путешествие", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Далее →", exact: true }),
  ).toBeDisabled();
  const nextRun = JSON.parse((await rawResult(page, keys.progress))!);
  expect(nextRun.runId).not.toBe(completed.runId);
  expect(nextRun.answers).toEqual(Array(10).fill(null));
  expect(await rawResult(page, keys.result)).toBe(JSON.stringify(completed));
});
