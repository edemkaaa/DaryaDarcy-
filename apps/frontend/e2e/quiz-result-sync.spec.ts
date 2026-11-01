import { expect, test, type Page } from "@playwright/test";
import { editorApi } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const cottage = "Девушка, вернувшая жизнь заброшенному саду";
const castle = "Девушка, пишущая свою легенду от руки";
const goblin = "Девушка, чьи карманы полны лесных сокровищ";
const resultKey = (owner: number | null) =>
  `darcy:user:${owner ?? "guest"}:@darcy_quiz_result`;
const progressKey = (owner: number | null) =>
  `darcy:user:${owner ?? "guest"}:@darcy_quiz_progress`;
type TraceWindow = typeof window & {
  resultWrites: number;
  failResultWrites: boolean;
};

function saved(primaryKey: "cottagecore" | "castlecore", blend = false) {
  return JSON.stringify({
    primaryKey,
    secondaryKey: blend ? "goblincore" : null,
    isBlend: blend,
    scores: {
      cottagecore: primaryKey === "cottagecore" ? (blend ? 12 : 21) : 0,
      goblincore: blend ? 9 : 0,
      witchcore: 0,
      castlecore: primaryKey === "castlecore" ? (blend ? 12 : 21) : 0,
      fairycore: 0,
      darkAcademia: 0,
      lightAcademia: 0,
    },
  });
}

async function setup(page: Page, owner: number | null = 101) {
  const identity = { owner };
  await editorApi(page);
  await page.route("https://**", (route) => route.abort());
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user:
          identity.owner === null
            ? null
            : {
                id: identity.owner,
                openId: `quiz-sync-${identity.owner}`,
                role: "user",
                name: "Участница",
                email: "quiz@example.test",
                profileRevision: 0,
                lastSignedIn: "2026-11-01T00:00:00Z",
              },
      },
    }),
  );
  await page.addInitScript((key) => {
    const trace = window as TraceWindow;
    trace.resultWrites = 0;
    trace.failResultWrites = false;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) {
        trace.resultWrites++;
        if (trace.failResultWrites)
          throw new DOMException(
            "Controlled quota failure",
            "QuotaExceededError",
          );
      }
      set.call(this, name, value);
    };
  }, resultKey(owner));
  await gotoWithSession(page, "/quiz");
  return identity;
}

async function setResult(
  page: Page,
  raw: string | null,
  owner: number | null = 101,
) {
  await page.evaluate(
    ({ key, raw }) => {
      if (raw === null) localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    },
    { key: resultKey(owner), raw },
  );
}
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true });
const start = (page: Page) =>
  page.getByRole("button", { name: "Начать путешествие", exact: true });
const writes = (page: Page) =>
  page.evaluate(() => (window as TraceWindow).resultWrites);
const stored = (page: Page, key: string) =>
  page.evaluate((key) => localStorage.getItem(key), key);
async function openResult(
  page: Page,
  raw = saved("cottagecore"),
  owner: number | null = 101,
) {
  const identity = await setup(page, owner);
  await setResult(page, raw, owner);
  await gotoWithSession(page, "/quiz/result");
  await expect(
    shown(page, raw === saved("castlecore") ? castle : cottage),
  ).toBeVisible();
  return identity;
}

for (const owner of [null, 101]) {
  test(`${owner === null ? "guest" : "member"}: another tab updates, removes and repairs the saved result without focus`, async ({
    page,
    context,
  }) => {
    await openResult(page, saved("cottagecore"), owner);
    const other = await context.newPage();
    await setup(other, owner);
    await setResult(other, saved("castlecore"), owner);
    await expect(shown(page, castle)).toBeVisible();
    await expect(shown(page, cottage)).toHaveCount(0);
    await setResult(other, null, owner);
    await expect(start(page)).toBeVisible();
    await expect(shown(page, castle)).toHaveCount(0);
    await setResult(other, saved("cottagecore"), owner);
    await expect(shown(page, cottage)).toBeVisible();
    await setResult(other, "{invalid", owner);
    await expect(start(page)).toBeVisible();
    expect(await stored(page, resultKey(owner))).toBe("{invalid");
    await setResult(other, saved("castlecore"), owner);
    await expect(shown(page, castle)).toBeVisible();
    await other.evaluate(() => localStorage.clear());
    await expect(start(page)).toBeVisible();
    await setResult(other, saved("cottagecore"), owner);
    await expect(shown(page, cottage)).toBeVisible();
    expect(await writes(page)).toBe(0);
    expect(await stored(page, resultKey(owner))).toBe(saved("cottagecore"));
  });
}

for (const event of ["focus", "pageshow"] as const) {
  test(`${event} rechecks the result when no storage event was delivered`, async ({
    page,
  }) => {
    await openResult(page);
    await setResult(page, saved("castlecore"));
    await page.evaluate((event) => {
      (window as TraceWindow).resultWrites = 0;
      window.dispatchEvent(new Event(event));
    }, event);
    await expect(shown(page, castle)).toBeVisible();
    expect(await writes(page)).toBe(0);
  });
}

test("a retained result refreshes when returning from another application section", async ({
  page,
  context,
}) => {
  await openResult(page);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Библиотека", exact: true })
    .click();
  await expect(page).toHaveURL(/\/library$/);
  const other = await context.newPage();
  await setup(other);
  await setResult(other, saved("castlecore"));
  await page
    .locator("header")
    .getByRole("button", { name: "Вернуться назад", exact: true })
    .click();
  await expect(page).toHaveURL(/\/quiz\/result$/);
  await expect(shown(page, castle)).toBeVisible();
  expect(await writes(page)).toBe(0);
});

test("a new blended result resets the previous secondary-aesthetic selection", async ({
  page,
  context,
}) => {
  await openResult(page, saved("cottagecore", true));
  await page.getByRole("button", { name: "Goblincore", exact: true }).click();
  await expect(shown(page, goblin)).toBeVisible();
  const other = await context.newPage();
  await setup(other);
  await setResult(other, saved("castlecore", true));
  await expect(shown(page, castle)).toBeVisible();
  await expect(shown(page, goblin)).toHaveCount(0);
  expect(await writes(page)).toBe(0);
});

async function answerCottagecore(
  page: Page,
  onQuestion?: (index: number) => Promise<void>,
) {
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
    const choice = page.getByRole("button", {
      name,
      exact: typeof name === "string",
    });
    await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await onQuestion?.(index);
    await page
      .getByRole("button", {
        name: index === 9 ? "Узнать результат" : "Далее →",
        exact: true,
      })
      .click();
  }
}

test("external results preserve a restart and in-progress answers, then sync after successful completion", async ({
  page,
  context,
}) => {
  await openResult(page);
  const other = await context.newPage();
  await setup(other);
  await page
    .getByRole("button", { name: "Пройти ещё раз", exact: true })
    .click();
  await expect(start(page)).toBeVisible();
  await setResult(other, saved("castlecore"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(start(page)).toBeVisible();
  await start(page).click();
  await answerCottagecore(page, async (index) => {
    if (index !== 0) return;
    const before = await stored(page, progressKey(101));
    await setResult(other, saved("cottagecore", true));
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await expect(
      page.getByRole("button", { name: /Тёплое спокойствие/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await stored(page, progressKey(101))).toBe(before);
    expect(await writes(page)).toBe(0);
  });
  await expect(shown(page, cottage)).toBeVisible();
  expect(await writes(page)).toBe(1);
  await setResult(other, saved("castlecore"));
  await expect(shown(page, castle)).toBeVisible();
  expect(await writes(page)).toBe(1);
});

test("a completed result that failed to save stays in memory when another tab changes storage", async ({
  page,
  context,
}) => {
  await openResult(page, saved("castlecore"));
  const other = await context.newPage();
  await setup(other);
  await page
    .getByRole("button", { name: "Пройти ещё раз", exact: true })
    .click();
  await start(page).click();
  await page.evaluate(() => {
    (window as TraceWindow).failResultWrites = true;
  });
  await answerCottagecore(page);
  await expect(shown(page, cottage)).toBeVisible();
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Прогресс теста не сохранён" }),
  ).toBeVisible();
  const before = await stored(page, progressKey(101));
  await setResult(other, saved("castlecore", true));
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await expect(shown(page, cottage)).toBeVisible();
  await expect(shown(page, castle)).toHaveCount(0);
  expect(await stored(page, progressKey(101))).toBe(before);
  expect(await writes(page)).toBe(1);
});

test("only the active account's result is read after an account switch", async ({
  page,
  context,
}) => {
  const identity = await openResult(page);
  const other = await context.newPage();
  await setup(other);
  await setResult(other, saved("castlecore"), 202);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(shown(page, cottage)).toBeVisible();
  identity.owner = 202;
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "second-owner",
      }),
    ),
  );
  await expect(shown(page, castle)).toBeVisible();
  await expect(shown(page, cottage)).toHaveCount(0);
  expect(await stored(page, resultKey(202))).toBe(saved("castlecore"));
});
