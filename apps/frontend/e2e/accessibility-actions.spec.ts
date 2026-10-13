import { test, expect, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.setTimeout(60_000);
test.use({ actionTimeout: 10_000 });
async function decoration(page: Page) {
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200"><rect width="480" height="200" fill="beige"/></svg>',
    }),
  );
}
const closedPanelButton = (page: Page) =>
  page.locator('[aria-label="Закрыть фильтры клуба"]');

// Focus attempts reproduce the defect even when the panel is outside the viewport.
test("closed club filters cannot receive keyboard or programmatic focus", async ({
  page,
}) => {
  await layoutApi(page, true);
  await decoration(page);
  await gotoWithSession(page, "/club");
  const open = page.getByRole("button", { name: "Открыть фильтры клуба" });
  await expect(open).toBeVisible();
  await open.focus();
  await closedPanelButton(page).evaluate((button: HTMLButtonElement) =>
    button.focus(),
  );
  await expect(open).toBeFocused();
  const panel = closedPanelButton(page).locator("xpath=ancestor::*[@inert][1]");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  for (let index = 0; index < 15; index++) {
    await page.keyboard.press("Tab");
    expect(
      await panel.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(false);
  }
});

for (const width of [390, 1440]) {
  test(`club filters support selection, Escape and focus return at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page, true);
    await decoration(page);
    await gotoWithSession(page, "/club");
    const open = page.getByRole("button", { name: "Открыть фильтры клуба" });
    await open.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("region", { name: "Фильтры клуба" });
    const close = panel.getByRole("button", { name: "Закрыть фильтры клуба" });
    await expect(close).toBeFocused();
    const winter = panel.getByRole("button", { name: "Зима", exact: true });
    await winter.focus();
    expect(await page.locator("main").evaluate((node) => node.scrollLeft)).toBe(
      0,
    );
    await page.keyboard.press("Space");
    await expect(winter).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: testInfo.outputPath(`club-filters-open-${width}.png`),
    });
    await page.keyboard.press("Space");
    await expect(winter).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await expect(async () => {
      const box = await closedPanelButton(page)
        .locator("xpath=ancestor::*[@role='region'][1]")
        .boundingBox();
      const viewportWidth = page.viewportSize()!.width;
      expect(box!.x).toBeGreaterThanOrEqual(
        viewportWidth > 480 ? (viewportWidth + 480) / 2 - 1 : viewportWidth - 1,
      );
    }).toPass({ timeout: 2000 });
    await page.screenshot({
      path: testInfo.outputPath(`club-filters-closed-${width}.png`),
    });
    await page.keyboard.press("Enter");
    await expect(winter).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Сбросить фильтр ×" }).click();
    await expect(open).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(winter).toHaveAttribute("aria-pressed", "false");
    // This panel is non-modal: background navigation remains available.
    const rubric = page.getByRole("button", { name: "Комьюнити", exact: true });
    await rubric.focus();
    await expect(rubric).toBeFocused();
    await close.click();
    await expect(open).toBeFocused();
  });
}

test("closed filters remain off-screen after resizing and rapid reopening", async ({
  page,
}) => {
  await layoutApi(page, true);
  await decoration(page);
  await gotoWithSession(page, "/club");
  const open = page.getByRole("button", { name: "Открыть фильтры клуба" });
  for (const width of [320, 480, 1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(async () => {
      const box = await closedPanelButton(page)
        .locator("xpath=ancestor::*[@role='region'][1]")
        .boundingBox();
      const main = await page.locator("main").boundingBox();
      expect(box).not.toBeNull();
      expect(main).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(main!.x + main!.width - 1);
    }).toPass({ timeout: 2000 });
    await open.click();
    await page.getByRole("button", { name: "Закрыть фильтры клуба" }).click();
    await open.click();
    await expect(
      page.getByRole("button", { name: "Закрыть фильтры клуба" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(open).toBeFocused();
  }
});

test("comment links and actions work with the keyboard and menu focus is restored", async ({
  page,
}) => {
  let liked = false;
  const createdAt = new Date().toISOString();
  await editorApi(page, (name) => {
    if (name === "club.list")
      return ok({
        posts: [
          {
            id: 1,
            text: "COMMENT_ACCESSIBILITY_POST",
            photos: [],
            media: [],
            richText: null,
            tags: ["community"],
            target: "club",
            createdAt,
            publishedAt: createdAt,
            likeCount: 0,
            commentCount: 1,
          },
        ],
        nextCursor: null,
      });
    if (name === "club.comments")
      return ok([
        {
          id: 11,
          postId: 1,
          userId: 101,
          parentId: null,
          userName: "Автор",
          avatarUrl: null,
          text: "Ссылка https://example.test/material и www.example.test/extra и https://username@example.test/private",
          photos: [],
          createdAt,
          likeCount: liked ? 1 : 0,
          likedByMe: liked,
        },
      ]);
    if (name === "club.toggleCommentLike") {
      liked = !liked;
      return ok({ liked, likeCount: liked ? 1 : 0 });
    }
  });
  await decoration(page);
  await gotoWithSession(page, "/club");
  const link = page.getByRole("link", {
    name: "https://example.test/material",
    exact: true,
  });
  await expect(link).toHaveAttribute("href", "https://example.test/material");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await link.focus();
  await expect(link).toBeFocused();
  await page
    .context()
    .route("https://example.test/material", (route) =>
      route.fulfill({ body: "material" }),
    );
  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup).toHaveURL("https://example.test/material");
  await popup.close();
  await expect(
    page.getByRole("link", { name: "www.example.test/extra" }),
  ).toHaveAttribute("href", "https://www.example.test/extra");
  await expect(
    page.getByRole("link", {
      name: "https://username@example.test/private",
      exact: true,
    }),
  ).toHaveCount(0);
  const like = page.getByRole("button", {
    name: "Поставить лайк комментарию",
    exact: true,
  });
  await like.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Убрать лайк комментария", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const menu = page.getByRole("button", {
    name: "Действия с комментарием",
    exact: true,
  });
  await menu.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Действия с комментарием" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Редактировать" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Отмена" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Редактировать" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test("main screens expose named visible buttons without horizontal overflow", async ({
  page,
}) => {
  await layoutApi(page, true);
  await decoration(page);
  for (const path of [
    "/feed",
    "/club",
    "/library",
    "/library/about-me",
    "/library/patterns",
    "/shop",
    "/shop/book-1",
    "/interactive",
    "/profile",
  ]) {
    await gotoWithSession(page, path);
    await expect(page.locator(".ui-scroll").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  }
  await gotoWithSession(page, "/feed");
  const search = page.locator('input[placeholder="Поиск..."]:visible');
  await search.fill("search");
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(search).toHaveValue("");
  const grid = page.getByRole("button", { name: "Показать сеткой" });
  await grid.focus();
  await page.keyboard.press("Space");
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Показать лентой" }).click();
  await expect(grid).toHaveAttribute("aria-pressed", "false");
});

test("visual quiz choices have a name and announce their selected state", async ({
  page,
}) => {
  await layoutApi(page);
  await decoration(page);
  await gotoWithSession(page, "/quiz");
  await page.getByRole("button", { name: "Начать путешествие" }).click();
  await page.getByRole("button", { name: /^Тёплое спокойствие/ }).click();
  await page.getByRole("button", { name: "Далее →", exact: true }).click();
  const choice = page.getByRole("button", {
    name: "Выбрать изображение 1",
    exact: true,
  });
  await expect(choice).toHaveAttribute("aria-pressed", "false");
  await choice.focus();
  await page.keyboard.press("Space");
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "", exact: true })).toHaveCount(
    0,
  );
});

test("the filter reset remains fully reachable by scrolling and keyboard on narrow and short screens", async ({
  page,
  browserName,
  isMobile,
}, testInfo) => {
  await layoutApi(page, true);
  await decoration(page);
  await gotoWithSession(page, "/club");
  for (const viewport of [
    { width: 320, height: 844 },
    { width: 390, height: 844 },
    { width: 480, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Открыть фильтры клуба" }).click();
    const winter = page.getByRole("button", { name: "Зима", exact: true });
    await winter.click();
    const reset = page.getByRole("button", { name: "Сбросить фильтр ×" });
    if (browserName === "webkit" && isMobile) {
      // Playwright cannot inject a wheel/touch swipe in mobile WebKit.
      // Exercise the real scroll container; do not claim a physical gesture.
      await winter.evaluate((button) => {
        for (
          let parent = button.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) {
            parent.scrollBy({ top: 1000 });
            break;
          }
        }
      });
    } else {
      const box = await winter.boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.wheel(0, 1000);
    }
    const chipsFit = await page
      .getByRole("region", { name: "Фильтры клуба" })
      .locator("button[aria-pressed]")
      .evaluateAll((buttons) =>
        buttons.every((button) => {
          const box = button.getBoundingClientRect();
          let left = 0,
            right = window.innerWidth;
          for (
            let parent = button.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            if (
              /auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowX)
            ) {
              const rect = parent.getBoundingClientRect();
              left = Math.max(left, rect.left);
              right = Math.min(right, rect.right);
            }
          }
          return box.left >= left - 1 && box.right <= right + 1;
        }),
      );
    expect(chipsFit).toBe(true);
    await expect(async () => {
      const fullyVisible = await reset.evaluate((button) => {
        const box = button.getBoundingClientRect();
        let left = 0,
          top = 0,
          right = window.innerWidth,
          bottom = window.innerHeight;
        for (
          let parent = button.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent),
            rect = parent.getBoundingClientRect();
          if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
            left = Math.max(left, rect.left);
            right = Math.min(right, rect.right);
          }
          if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
            top = Math.max(top, rect.top);
            bottom = Math.min(bottom, rect.bottom);
          }
        }
        return (
          box.left >= left - 1 &&
          box.right <= right + 1 &&
          box.top >= top - 1 &&
          box.bottom <= bottom + 1
        );
      });
      expect(fullyVisible).toBe(true);
    }).toPass({ timeout: 2000 });
    await reset.focus();
    await expect(reset).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(
        `filter-reset-${viewport.width}-${viewport.height}.png`,
      ),
    });
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Открыть фильтры клуба" }),
    ).toBeFocused();
  }
});
