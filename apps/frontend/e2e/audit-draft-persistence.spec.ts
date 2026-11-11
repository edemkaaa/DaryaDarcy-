import { expect, test, type Page } from "@playwright/test";
import { editorApi, ok, failure } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

/** Заходим в текущий admin-раздел статей обычной навигацией. */
async function articles(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
}
/** Адресуем изменяемый заголовок редактора статьи. */
const title = (page: Page) => page.getByPlaceholder("Что посмотреть осенью...");
/** Читаем new-slot из IndexedDB с настоящими File-байтами и закрываем соединение на успехе/ошибке. */
async function savedDraft(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        title: string;
        text: string | null;
        fileCount: number;
      } | null>((resolve, reject) => {
        const request = indexedDB.open("darcy-article-drafts", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("drafts")
            .objectStore("drafts")
            .get("101:new");
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
          read.onsuccess = async () => {
            const record = read.result;
            db.close();
            resolve(
              record
                ? {
                    title: record.snapshot.title,
                    text: record.files[0]
                      ? await record.files[0].file.text()
                      : null,
                    fileCount: record.files.length,
                  }
                : null,
            );
          };
        };
      }),
  );
}

/** Несохранённая статья восстанавливает поля и файл после reload без remote-write; удаление локального draft требует отдельного подтверждения. */
test("an unsent article restores its fields and actual file bytes after reload", async ({
  page,
}) => {
  const writes: string[] = [];
  await editorApi(page, (name) => {
    if (
      [
        "admin.createArticle",
        "admin.updateArticle",
        "admin.uploadPrivateContentFile",
      ].includes(name)
    )
      writes.push(name);
  });
  await articles(page);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await title(page).fill("UNSENT_ARTICLE");
  await page
    .getByRole("button", { name: "Статус: опубликована", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Клуб + библиотека", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ссылка", exact: true })
    .first()
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Загрузить файл", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "draft.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("unsent private document"),
  });
  await expect
    .poll(() => savedDraft(page))
    .toEqual({
      title: "UNSENT_ARTICLE",
      text: "unsent private document",
      fileCount: 1,
    });
  await page.reload();
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page
    .getByRole("button", { name: "Продолжить черновик статьи", exact: true })
    .click();
  await expect(title(page)).toHaveValue("UNSENT_ARTICLE");
  await expect(
    page.getByRole("button", { name: "Статус: черновик", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/В библиотеке статью можно читать без подписки/),
  ).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(
    0,
  );
  await expect
    .poll(() => savedDraft(page))
    .toEqual({
      title: "UNSENT_ARTICLE",
      text: "unsent private document",
      fileCount: 1,
    });
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Продолжить черновик статьи",
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Удалить черновик с устройства", exact: true })
    .click();
  await expect.poll(() => savedDraft(page)).toBeNull();
});

/** Устаревшая вкладка сохраняет свой ввод в форме, но не перезаписывает более новый durable-draft. */
test("a second article tab cannot overwrite a newer draft", async ({
  page,
  context,
}) => {
  await editorApi(page);
  await articles(page);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await title(page).fill("FIRST_TAB");
  await expect
    .poll(async () => (await savedDraft(page))?.title)
    .toBe("FIRST_TAB");
  const other = await context.newPage();
  await editorApi(other);
  await articles(other);
  await other
    .getByRole("button", { name: "Продолжить черновик статьи", exact: true })
    .click();
  await title(other).fill("SECOND_TAB");
  await expect
    .poll(async () => (await savedDraft(other))?.title)
    .toBe("SECOND_TAB");
  await title(page).fill("DO_NOT_OVERWRITE");
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "изменился в другой вкладке" }),
  ).toBeVisible();
  expect((await savedDraft(page))?.title).toBe("SECOND_TAB");
  await expect(title(page)).toHaveValue("DO_NOT_OVERWRITE");
});

/** Отказ local-put оставляет исходный durable-snapshot и не позволяет закрыть форму с несохранённым вводом. */
test("article storage failure keeps the editor open and reports unsaved input", async ({
  page,
}) => {
  await editorApi(page);
  await articles(page);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await title(page).fill("BEFORE_FAILURE");
  await expect
    .poll(async () => (await savedDraft(page))?.title)
    .toBe("BEFORE_FAILURE");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    /** Quota-error относится только к article-drafts, остальные IndexedDB операции сохраняют нативное поведение. */
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === "darcy-article-drafts")
        throw new DOMException("Full", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await title(page).fill("UNSAVED_INPUT");
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Не удалось сохранить или прочитать черновик" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(title(page)).toHaveValue("UNSAVED_INPUT");
  expect((await savedDraft(page))?.title).toBe("BEFORE_FAILURE");
});

/** Reload восстанавливает только уже подтверждённый storage-lock/write выбор и текущий номер вопроса. */
test("quiz answers and current question survive reload", async ({ page }) => {
  await editorApi(page);
  await gotoWithSession(page, "/quiz");
  await page.getByRole("button", { name: "Начать путешествие" }).click();
  await page.getByRole("button", { name: /^Тёплое спокойствие/ }).click();
  await page.getByRole("button", { name: "Далее →", exact: true }).click();
  await page
    .getByRole("button", { name: "Выбрать изображение 1", exact: true })
    .click();
  // A committed selection is shown only after the storage lock and write finish.
  await expect(
    page.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Выбрать изображение 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("darcy:user:101:@darcy_quiz_progress")!),
  );
  expect(progress.currentQuestion).toBe(1);
  expect(progress.answers.slice(0, 2).every(Boolean)).toBe(true);
});

/** Если durable-журнал имени недоступен, profile.update не отправляется, а ввод остаётся в поле. */
test("profile storage failure is visible and prevents an unrecoverable mutation", async ({
  page,
}) => {
  let writes = 0;
  await editorApi(page, (name, input) => {
    if (name === "profile.update") {
      writes++;
      return ok({
        success: true,
        profileRevision: Number(input.expectedRevision) + 1,
      });
    }
  });
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Тест", exact: true }).click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    /** Отказываем только profile_name-ключам, сохраняя прочие записи приложения. */
    Storage.prototype.setItem = function (key, value) {
      if (key.includes("profile_name"))
        throw new DOMException("Full", "QuotaExceededError");
      set.call(this, key, value);
    };
  });
  await page
    .getByRole("textbox", { name: "Имя профиля", exact: true })
    .fill("KEPT_IN_FORM");
  await expect(
    page.getByRole("alert").filter({ hasText: "Черновик имени" }),
  ).toContainText("Черновик имени не сохранён");
  await page
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Запрос не отправлен" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Имя профиля", exact: true }),
  ).toHaveValue("KEPT_IN_FORM");
  expect(writes).toBe(0);
});

/** Uncertain-update переживает reload и блокирует новый write до сверки исходного результата. */
test("an uncertain article update remains blocked after reload", async ({
  page,
}) => {
  let writes = 0;
  await editorApi(page, (name) => {
    if (name === "admin.articles")
      return ok([
        {
          id: 7,
          title: "SERVER_ARTICLE",
          coverUrl: null,
          access: "club",
          published: true,
          sections: [{ type: "text", text: "original" }],
        },
      ]);
    if (name === "admin.updateArticle") {
      writes++;
      return failure(503);
    }
  });
  page.on("dialog", (dialog) => dialog.accept());
  await articles(page);
  await page.getByRole("button", { name: "Править", exact: true }).click();
  await title(page).fill("UNCERTAIN_EDIT");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page
    .getByRole("button", { name: "Продолжить черновик статьи", exact: true })
    .click();
  await expect(title(page)).toHaveValue("UNCERTAIN_EDIT");
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Перед перезагрузкой было отправлено" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  expect(writes).toBe(1);
});

/** Новый account-scope не показывает чужой draft, сохраняя оригинал для первого владельца. */
test("article drafts never appear in the next account", async ({ page }) => {
  await editorApi(page);
  await articles(page);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await title(page).fill("FIRST_OWNER_PRIVATE_DRAFT");
  await expect
    .poll(async () => (await savedDraft(page))?.title)
    .toBe("FIRST_OWNER_PRIVATE_DRAFT");
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 202,
          openId: "second-owner",
          name: "Second",
          role: "admin",
          email: "second@example.test",
          lastSignedIn: "2026-10-27T00:00:00Z",
        },
      },
    }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "second-owner",
      }),
    ),
  );
  await expect(title(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Продолжить черновик статьи",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await expect(title(page)).toHaveValue("");
  expect((await savedDraft(page))?.title).toBe("FIRST_OWNER_PRIVATE_DRAFT");
});

/** Разные article-id имеют собственные draft-slots и переживают переключение форм без server-write. */
test("separate article drafts both survive switching editors and reloading", async ({
  page,
}) => {
  let writes = 0;
  await editorApi(page, (name) => {
    if (name === "admin.articles")
      return ok(
        [7, 8].map((id) => ({
          id,
          title: `SERVER_${id}`,
          coverUrl: null,
          access: "club",
          published: true,
          sections: [{ type: "text", text: "original" }],
        })),
      );
    if (name === "admin.updateArticle" || name === "admin.createArticle")
      writes++;
  });
  await articles(page);
  for (const index of [0, 1]) {
    await page
      .getByRole("button", { name: "Править", exact: true })
      .nth(index)
      .click();
    await title(page).fill(`LOCAL_${index}`);
    await page.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(title(page)).toHaveCount(0);
  }
  await page.reload();
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  for (const index of [0, 1]) {
    await page
      .getByRole("button", { name: "Править", exact: true })
      .nth(index)
      .click();
    await expect(title(page)).toHaveValue(`LOCAL_${index}`);
    await page.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(title(page)).toHaveCount(0);
  }
  expect(writes).toBe(0);
});
