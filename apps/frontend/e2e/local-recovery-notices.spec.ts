import { expect, test, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";
import { serializeQuizProgress } from "../src/domain/quiz/quiz-progress";

const notice = (page: Page) =>
  page.locator("[data-background-notice] [role=status]");
async function fixture(page: Page) {
  await editorApi(page, (name) =>
    name === "club.subscription"
      ? ok({
          hasClubAccess: false,
          subscribed: false,
          expiresAt: null,
          cancelAtPeriodEnd: false,
          cancellationStatus: "none",
          isOwner: false,
          monthlyPrice: "790",
        })
      : undefined,
  );
  await page.route("https://**", (route) => route.abort());
}
async function failQuizWrites(page: Page) {
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Object.assign(window, { failQuizWrites: true });
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "darcy:user:101:@darcy_quiz_progress" &&
        (window as unknown as { failQuizWrites: boolean }).failQuizWrites
      )
        throw new DOMException("Full", "QuotaExceededError");
      set.call(this, key, value);
    };
  });
}
for (const width of [320, 390, 1280]) {
  test(`quiz storage errors use one bottom notice without moving the question or covering navigation (${width}px)`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await fixture(page);
    await gotoWithSession(page, "/quiz");
    await page
      .getByRole("button", { name: "Начать путешествие", exact: true })
      .click();
    const first = page.getByRole("button", { name: /^Тёплое спокойствие/ });
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => document.fonts.ready);
    const question = page.getByText("Что ты чувствуешь?", { exact: true });
    const next = page.getByRole("button", { name: "Далее →", exact: true });
    const before = {
      question: await question.boundingBox(),
      next: await next.boundingBox(),
    };
    const raw = await page.evaluate(() =>
      localStorage.getItem("darcy:user:101:@darcy_quiz_progress"),
    );
    await failQuizWrites(page);
    const second = page.getByRole("button", { name: /^Жгучее любопытство/ });
    await second.click();
    await expect(notice(page)).toContainText("Прогресс теста не сохранён");
    await expect(page.locator("[data-background-notice]")).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    expect(await question.boundingBox()).toEqual(before.question);
    expect(await next.boundingBox()).toEqual(before.next);
    const box = (await notice(page).boundingBox())!;
    expect(box.height).toBeLessThan(180);
    expect(box.y + box.height).toBeLessThanOrEqual(before.next!.y - 8);
    await expect(notice(page).getByRole("button")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("darcy:user:101:@darcy_quiz_progress"),
      ),
    ).toBe(raw);
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: info.outputPath(`quiz-storage-${width}.png`),
      animations: "disabled",
    });
    await page.evaluate(() => Object.assign(window, { failQuizWrites: false }));
    await first.click();
    await expect(notice(page)).toHaveCount(0);
    await next.click();
    await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
  });
}

test("a shared session retry never accepts another tab's quiz or discards an unsaved answer", async ({
  page,
}) => {
  await fixture(page);
  await gotoWithSession(page, "/quiz");
  await page
    .getByRole("button", { name: "Начать путешествие", exact: true })
    .click();
  await failQuizWrites(page);
  const answer = page.getByRole("button", { name: /^Жгучее любопытство/ });
  await answer.click();
  await expect(notice(page)).toContainText("Прогресс теста не сохранён");
  const otherProgress = serializeQuizProgress(
    {
      phase: "question",
      currentQuestion: 1,
      answers: ["1a", null, null, null, null, null, null, null, null, null],
      result: null,
    },
    { runId: "11111111-1111-4111-8111-111111111111", revision: 1 },
  );
  await page.evaluate((raw) => {
    Object.assign(window, { failQuizWrites: false });
    const key = "darcy:user:101:@darcy_quiz_progress";
    localStorage.setItem(key, raw);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: raw }));
  }, otherProgress);
  await expect(
    notice(page).getByRole("button", {
      name: "Продолжить сохранённый тест",
      exact: true,
    }),
  ).toBeVisible();
  let sessionFails = true;
  await page.route("**/api/auth/me", (route) =>
    sessionFails ? route.abort("failed") : route.fallback(),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(notice(page)).toContainText("Не удалось обновить сессию");
  await expect(page.locator("[data-background-notice]")).toHaveCount(1);
  sessionFails = false;
  await notice(page)
    .getByRole("button", { name: "Повторить", exact: true })
    .click();
  await expect(notice(page)).toContainText(
    "В другой вкладке уже есть изменения",
  );
  await expect(answer).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("darcy:user:101:@darcy_quiz_progress"),
    ),
  ).toBe(otherProgress);
  await notice(page)
    .getByRole("button", { name: "Продолжить сохранённый тест", exact: true })
    .click();
  await expect(notice(page)).toHaveCount(0);
  await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
});

test("a corrupted avatar uses the shared slot and a general retry never resets its stored copy", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await fixture(page);
  await gotoWithSession(page, "/profile");
  const avatar = page.getByRole("button", {
    name: "Выбрать фото профиля",
    exact: true,
  });
  await page.evaluate(() =>
    localStorage.setItem("darcy:user:101:avatar-upload", "{damaged"),
  );
  await page.reload();
  await expect(notice(page)).toContainText("Не удалось открыть черновик фото");
  await expect(page.locator("[data-background-notice]")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(avatar).toBeDisabled();
  const box = (await notice(page).boundingBox())!;
  const nav = (await page
    .getByRole("navigation", { name: "Разделы", exact: true })
    .boundingBox())!;
  expect(box.height).toBeLessThan(260);
  expect(nav.y - box.y - box.height).toBeCloseTo(12, 0);
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs++;
    void dialog.dismiss();
  });
  await notice(page)
    .getByRole("button", { name: "Повторить", exact: true })
    .click();
  await expect(notice(page)).toContainText("Не удалось открыть черновик фото");
  expect(dialogs).toBe(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("darcy:user:101:avatar-upload"),
    ),
  ).toBe("{damaged");
  await expect(
    notice(page).getByRole("button", { name: "Скачать копию", exact: true }),
  ).toBeVisible();
  await expect(
    notice(page).getByRole("button", {
      name: "Сбросить черновик",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("avatar-storage-320.png"),
    animations: "disabled",
  });
  await page
    .getByRole("navigation", { name: "Разделы", exact: true })
    .getByRole("link", { name: "Библиотека", exact: true })
    .click();
  await expect(notice(page)).toHaveCount(0);
});
