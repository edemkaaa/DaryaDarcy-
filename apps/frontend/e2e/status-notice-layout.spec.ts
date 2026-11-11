import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { editorApi, failure, ok } from "./editor-fixtures";

const catalogEnabled = process.env.VK_CATALOG_UI_ENABLED === "true";

/** Сверяем notice и его действие с доступным main между шапкой и меню; standalone-404 измеряется отдельно, а при ошибке прикладываем геометрию для диагностики. */
async function outsideNavigation(
  page: Page,
  notice: Locator,
  standalone = false,
) {
  await expect(notice).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const control = notice.locator("button, a").first();
  if (await control.count()) await control.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize()!;
  // Next's unmatched-route fallback is outside the tab shell and has no session read.
  const header = standalone
    ? { y: 0, height: 0 }
    : (await page
        .getByRole("banner", { name: "Навигация профиля" })
        .boundingBox())!;
  const navigation = standalone
    ? { y: viewport.height }
    : (await page
        .getByRole("navigation", { name: "Разделы", exact: true })
        .boundingBox())!;
  const main = standalone
    ? { x: 0, width: viewport.width }
    : (await page.locator("main").boundingBox())!;
  const card = (await notice.boundingBox())!;
  if (
    card.y < Math.max(0, header.y + header.height) ||
    card.y + card.height > navigation.y + 1
  ) {
    await test.info().attach("notice-layout.json", {
      contentType: "application/json",
      body: JSON.stringify(
        await notice.evaluate((node) =>
          [node, ...node.querySelectorAll("div,button,a")].map((element) => {
            const r = element.getBoundingClientRect();
            const s = getComputedStyle(element);
            return {
              tag: element.tagName,
              class: element.className,
              rect: { x: r.x, y: r.y, width: r.width, height: r.height },
              flex: s.flex,
              direction: s.flexDirection,
              container: s.containerType,
            };
          }),
        ),
        null,
        2,
      ),
    });
  }
  expect(card.y).toBeGreaterThanOrEqual(Math.max(0, header.y + header.height));
  expect(card.y + card.height).toBeLessThanOrEqual(navigation.y + 1);
  expect(card.x).toBeGreaterThanOrEqual(main.x);
  expect(card.x + card.width).toBeLessThanOrEqual(main.x + main.width + 1);
  expect(
    await notice.evaluate((node) => node.scrollWidth > node.clientWidth + 1),
  ).toBe(false);
  if (await control.count()) {
    expect(
      await control.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        );
      }),
    ).toBe(true);
  }
}

/** Матрица размеров покрывает отсутствующий маршрут/материал, начальные API-ошибки, сессию, подписку, render-boundary и диалог файлов. */
for (const [width, height] of [
  [320, 400],
  [390, 844],
  [1440, 844],
]) {
  test.describe(`notices outside navigation at ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("an unknown route keeps its standalone 404 notice and home link inside the viewport", async ({
      page,
    }) => {
      await layoutApi(page);
      const response = await page.goto("/missing-status-layout", {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("banner")).toHaveCount(0);
      await expect(page.getByRole("navigation")).toHaveCount(0);
      const notice = page
        .getByRole("status")
        .filter({ hasText: "Страница не найдена." });
      await outsideNavigation(page, notice, true);
      await page.screenshot({ path: test.info().outputPath("not-found.png") });
      await notice
        .getByRole("link", { name: "Вернуться на главную →" })
        .click();
      await expect(page).toHaveURL(/\/$/);
    });

    for (const [path, message] of [
      ["/post/not-an-id", "Пост не найден"],
      ["/video/not-an-id", "Видео не найдено"],
      ["/library/article/not-an-id", "Статья не найдена"],
    ]) {
      test(`missing content on ${path} stays below the header`, async ({
        page,
      }) => {
        await layoutApi(page);
        await gotoWithSession(page, path);
        await outsideNavigation(
          page,
          page.getByRole("status").filter({ hasText: message }),
        );
      });
    }

    for (const [path, procedure, message] of [
      ["/post/700", "feed.getById", "Сервис временно недоступен"],
      [
        "/library/article/700",
        "articles.getById",
        "Сервис временно недоступен",
      ],
      ["/feed", "feed.listPaginated", "Не удалось загрузить ленту"],
      [
        "/videos",
        catalogEnabled ? "videos.catalog" : "videos.list",
        "Не удалось загрузить видео",
      ],
    ]) {
      test(`a failed initial read on ${path} keeps retry clear of navigation`, async ({
        page,
      }) => {
        await layoutApi(page, false, (name) =>
          name === procedure ? failure(503) : undefined,
        );
        await gotoWithSession(page, path);
        await outsideNavigation(
          page,
          page.getByRole("alert").filter({ hasText: message }),
        );
      });
    }

    for (const path of ["/profile", "/club"]) {
      test(`a failed session on ${path} keeps retry below the header`, async ({
        page,
      }) => {
        await layoutApi(page);
        await page.route("**/api/auth/me", (route) =>
          route.fulfill({ status: 503, json: { error: "unavailable" } }),
        );
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await outsideNavigation(
          page,
          page
            .getByRole("alert")
            .filter({ hasText: "Сервис временно недоступен" }),
        );
      });
    }

    test("a failed subscription on Club keeps retry between the header and tabs", async ({
      page,
    }) => {
      await layoutApi(page, true, (name) =>
        name === "club.subscription" ? failure(503) : undefined,
      );
      await gotoWithSession(page, "/club");
      await outsideNavigation(
        page,
        page
          .getByRole("alert")
          .filter({ hasText: "Не удалось проверить подписку" }),
      );
    });

    /** Точечно вызываем render-error только для fixture-даты, затем снимаем инъекцию и проверяем recovery boundary через настоящую кнопку. */
    test("a page render error keeps its recovery action below the header", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const nativeGetDate = Date.prototype.getDate;
        /** Остальные даты проходят в native-метод; контролируемый throw нужен для проверки границы ошибки, а не отказа HTTP. */
        Date.prototype.getDate = function () {
          if (
            this.getTime() === Date.parse("2026-10-02T12:00:00Z") &&
            !(window as unknown as { allowNoticeRender?: boolean })
              .allowNoticeRender
          )
            throw new Error("Synthetic post date render failure");
          return nativeGetDate.call(this);
        };
      });
      await layoutApi(page, false, (name) =>
        name === "feed.listPaginated"
          ? ok({
              posts: [
                {
                  id: 700,
                  text: "NOTICE_RENDER_RECOVERY_POST",
                  photos: [],
                  tags: [],
                  media: [],
                  richText: null,
                  target: "feed",
                  likeCount: 0,
                  commentCount: 0,
                  createdAt: "2026-10-02T12:00:00Z",
                  publishedAt: "2026-10-02T12:00:00Z",
                },
              ],
              nextCursor: null,
            })
          : undefined,
      );
      await gotoWithSession(page, "/feed");
      const notice = page.getByRole("alert").filter({
        hasText: "Не удалось открыть страницу.",
      });
      await outsideNavigation(page, notice);
      await page.evaluate(() =>
        Object.assign(window, { allowNoticeRender: true }),
      );
      await notice
        .getByRole("button", { name: "Попробовать ещё раз", exact: true })
        .click();
      await expect(notice).toHaveCount(0);
      await expect(
        page.getByText("NOTICE_RENDER_RECOVERY_POST", { exact: true }),
      ).toBeVisible();
    });

    /** Некорректный read-response отклоняется до React-render, поэтому виден query-retry, а не render-error boundary. */
    test("a malformed initial list is rejected before rendering and retry stays reachable", async ({
      page,
    }) => {
      let valid = false;
      await layoutApi(page, false, (name) =>
        name === "feed.listPaginated" && !valid
          ? ok({ posts: [null], nextCursor: null })
          : undefined,
      );
      await gotoWithSession(page, "/feed");
      const notice = page
        .getByRole("alert")
        .filter({ hasText: "Не удалось загрузить ленту" });
      await outsideNavigation(page, notice);
      await expect(
        page.getByText("Не удалось открыть страницу.", { exact: true }),
      ).toHaveCount(0);
      valid = true;
      await notice
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await expect(notice).toHaveCount(0);
      await expect(page.getByRole("article").first()).toBeVisible();
    });

    test("a failed admin list keeps retry reachable after its toolbars", async ({
      page,
    }) => {
      await editorApi(page, (name) =>
        name === "admin.postsPage" ? failure(503) : undefined,
      );
      await gotoWithSession(page, "/admin");
      await outsideNavigation(
        page,
        page
          .getByRole("alert")
          .filter({ hasText: "Не удалось загрузить список" }),
      );
    });

    /** 401, 403 и инфраструктурная ошибка playback имеют разные действия; эти случаи работают только в catalog-профиле сборки. */
    for (const [status, message] of [
      [401, "Войдите, чтобы смотреть это видео"],
      [403, "Для просмотра нужен доступ к клубу"],
      [500, "Сервис временно недоступен"],
    ] as const) {
      test(`video playback ${status} leaves its recovery action outside navigation`, async ({
        page,
      }) => {
        test.skip(
          !catalogEnabled,
          "Requires the opt-in VK catalog build; covered by the catalog profile.",
        );
        await layoutApi(page, false, (name) => {
          if (name === "videos.playback") return failure(status);
          if (name === "videos.catalog")
            return ok({
              items: [
                {
                  id: 700,
                  title: "Видео",
                  duration: null,
                  access: "club",
                  canWatch: false,
                },
              ],
              nextCursor: null,
            });
        });
        await gotoWithSession(page, "/video/700");
        const notice = page
          .locator('[role="alert"], [role="status"]')
          .filter({ hasText: message });
        await outsideNavigation(page, notice);
        await expect(page.locator("iframe")).toHaveCount(0);
        await expect(
          notice.getByRole("button", {
            name:
              status === 401
                ? "Войти"
                : status === 403
                  ? "Перейти в клуб"
                  : "Повторить",
            exact: true,
          }),
        ).toBeVisible();
        if (status !== 500)
          await expect(
            notice.getByRole("button", { name: "Повторить", exact: true }),
          ).toHaveCount(0);
      });
    }

    /** В узком file-dialog retry и закрытие остаются внутри доступной области; основной экран при модальности inert. */
    test("a narrow file dialog keeps its message, retry and close action usable", async ({
      page,
    }) => {
      await layoutApi(page, true);
      await page.route("**/api/library/materials/recipes/files", (route) =>
        route.fulfill({ status: 503, json: { error: "unavailable" } }),
      );
      await gotoWithSession(page, "/library");
      await page
        .getByRole("button", {
          name: "Открыть материал: Сборник рецептов",
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Сборник рецептов",
        exact: true,
      });
      const notice = dialog.getByRole("alert");
      await expect(notice).toContainText("Материал сейчас недоступен");
      const retry = notice.getByRole("button", {
        name: "Повторить",
        exact: true,
      });
      await retry.scrollIntoViewIfNeeded();
      const card = (await notice.boundingBox())!;
      const action = (await retry.boundingBox())!;
      expect(action.x).toBeGreaterThanOrEqual(card.x + 8);
      expect(action.x + action.width).toBeLessThanOrEqual(
        card.x + card.width - 8,
      );
      expect(
        await notice.evaluate(
          (node) => node.scrollWidth > node.clientWidth + 1,
        ),
      ).toBe(false);
      expect(
        await page
          .locator("main")
          .evaluate((node) => Boolean(node.closest("[inert]"))),
      ).toBe(true);
      const close = dialog.getByRole("button", {
        name: "Закрыть",
        exact: true,
      });
      await close.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: test.info().outputPath("file-error-dialog.png"),
      });
      await close.click();
      await expect(dialog).toHaveCount(0);
    });
  });
}
