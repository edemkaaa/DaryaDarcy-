import { expect, test, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

/** Переходим клиентским router в том же документе, сохраняя QueryClient для проверки инвалидации. */
async function navigate(page: Page, path: string) {
  await page.evaluate((destination) => {
    const { next } = window as Window & {
      next?: { router: { push(path: string): void } };
    };
    if (!next) throw new Error("Client router unavailable");
    next.router.push(destination);
  }, path);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

/** Одна и та же статья уже находится в кэше читателя; после подтверждённой правки или удаления возврат должен перечитать её без reload. */
for (const action of ["edit", "delete"] as const) {
  test(`cached article reflects confirmed ${action} without reloading`, async ({
    page,
  }) => {
    let article: {
      id: number;
      title: string;
      access: "public";
      published: boolean;
      coverUrl: null;
      sections: { type: "text"; text: string }[];
    } | null = {
      id: 700,
      title: "Статья до изменения",
      access: "public",
      published: true,
      coverUrl: null,
      sections: [{ type: "text", text: "Содержимое статьи" }],
    };
    let reads = 0;
    let writes = 0;
    const origin = new URL(test.info().project.use.baseURL!).origin;
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    page.on("dialog", (dialog) => dialog.accept());
    await editorApi(page, (name, input) => {
      if (name === "articles.getById") {
        reads++;
        return ok(article ? { ...article, locked: false } : null);
      }
      if (name === "articles.list" || name === "admin.articles")
        return ok(article ? [article] : []);
      if (name === "admin.updateArticle") {
        writes++;
        if (article) article = { ...article, title: String(input.title) };
        return ok({ ok: true });
      }
      if (name === "admin.deleteArticle") {
        writes++;
        article = null;
        return ok({ ok: true });
      }
    });
    await gotoWithSession(page, "/library/article/700");
    await expect(
      page.getByText("Содержимое статьи", { exact: true }),
    ).toBeVisible();
    // Keep the same document and QueryClient across both routes.
    await navigate(page, "/admin");
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    if (action === "edit") {
      await page.getByRole("button", { name: "Править", exact: true }).click();
      await page
        .getByPlaceholder("Что посмотреть осенью...")
        .fill("Статья после изменения");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Написать статью", exact: true }),
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Удалить", exact: true }).click();
      await expect(
        page.getByText("Статья до изменения", { exact: true }),
      ).toHaveCount(0);
    }
    expect(writes).toBe(1);
    const readsBeforeReturn = reads;
    await navigate(page, "/library/article/700");
    await expect(
      page.getByText(
        action === "edit" ? "Статья после изменения" : "Статья не найдена",
        { exact: true },
      ),
    ).toBeVisible();
    expect(reads).toBeGreaterThan(readsBeforeReturn);
    await expect(
      page.getByText("Статья до изменения", { exact: true }),
    ).toHaveCount(0);
  });
}
