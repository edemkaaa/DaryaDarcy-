import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const headerSelector = 'header[aria-label="Навигация профиля"]';
const scrollSelector = "main .ui-scroll:not(.ui-scroll-horizontal):visible";

/** Проверяем бумажную шапку целиком вместе с её фоном: скрытие не меняет viewport контента или положение нижнего меню. */
for (const width of [390, 1440]) {
  test.describe(`paper header at ${width}px`, () => {
    test.use({ viewport: { width, height: 400 } });

    /** Для страниц разной структуры даём достаточную высоту содержимого и сравниваем spacer, hit-testing, край прокрутки и возвращение шапки. */
    for (const path of [
      "/library/patterns",
      "/library/about-me",
      "/library/aesthetics-guide",
      "/library/article/700",
      "/interactive",
      "/quiz",
      "/video/700",
      "/shop/book-1",
      "/legal/offer",
      "/privacy",
      "/login",
    ]) {
      test(`${path} hides the background with the controls and keeps the scroll viewport stable`, async ({
        page,
      }) => {
        await layoutApi(page, true, (name) => {
          const data =
            name === "articles.getById"
              ? {
                  id: 700,
                  title: "Длинная статья",
                  published: true,
                  locked: false,
                  coverUrl: null,
                  sections: Array.from({ length: 20 }, () => ({
                    type: "text",
                    text: "Текст для проверки прокрутки страницы и скрытия всего хедера. ".repeat(
                      6,
                    ),
                  })),
                }
              : name === "videos.getById"
                ? {
                    id: 700,
                    title: "Длинное описание видео. ".repeat(30),
                    videoUrl: null,
                    youtubeId: "test-video",
                  }
                : name === "videos.catalog"
                  ? {
                      items: [
                        {
                          id: 700,
                          title: "Длинное описание видео. ".repeat(30),
                          duration: null,
                          access: "public",
                          canWatch: true,
                        },
                      ],
                      nextCursor: null,
                    }
                  : name === "videos.playback"
                    ? {
                        id: 700,
                        provider: "youtube",
                        youtubeId: "dQw4w9WgXcQ",
                        videoUrl: null,
                      }
                    : undefined;
          return data ? { result: { data: { json: data } } } : undefined;
        });
        await gotoWithSession(page, path);
        const header = page.locator(headerSelector);
        const scroll = page.locator(scrollSelector).first();
        await expect(scroll).toBeVisible();
        await expect(header).toHaveAttribute("data-hidden", "false");
        await expect
          .poll(() => scroll.evaluate((node) => node.scrollTop))
          .toBe(0);
        const viewport = await scroll.boundingBox();
        expect(viewport?.y).toBe(0);
        // Space for the visible header scrolls away with the content.
        expect(
          await scroll.evaluate((node) => ({
            spacer: getComputedStyle(node, "::before").flexBasis,
            contentTop: node.firstElementChild!.getBoundingClientRect().top,
          })),
        ).toEqual({ spacer: "44px", contentTop: 44 });
        if (path === "/library/patterns")
          await page.screenshot({
            path: test.info().outputPath("whole-header-visible.png"),
          });
        await expect
          .poll(() =>
            scroll.evaluate((node) => node.scrollHeight - node.clientHeight),
          )
          .toBeGreaterThan(40);
        const tabs = await page
          .getByRole("navigation", { name: "Разделы", exact: true })
          .boundingBox();
        await scroll.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await expect(header).toHaveAttribute("data-hidden", "true");
        await expect
          .poll(() =>
            header.evaluate((node) => node.getBoundingClientRect().bottom),
          )
          .toBeLessThanOrEqual(0);
        expect(await scroll.boundingBox()).toEqual(viewport);
        expect(
          await scroll.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return node.contains(
              document.elementFromPoint(rect.x + rect.width / 2, rect.y + 10),
            );
          }),
        ).toBe(true);
        // No viewport resize or scroll clamping may reveal it again at the end.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        await expect(header).toHaveAttribute("data-hidden", "true");
        if (path === "/library/patterns")
          await page.screenshot({
            path: test.info().outputPath("whole-header-hidden.png"),
          });
        await scroll.evaluate((node) => {
          node.scrollTop -= 20;
        });
        await expect(header).toHaveAttribute("data-hidden", "false");
        await expect
          .poll(() =>
            header.evaluate((node) => node.getBoundingClientRect().top),
          )
          .toBe(0);
        expect(await scroll.boundingBox()).toEqual(viewport);
        expect(
          await page
            .getByRole("navigation", { name: "Разделы", exact: true })
            .boundingBox(),
        ).toEqual(tabs);
        await scroll.evaluate((node) => {
          node.scrollTop = 0;
        });
        await expect(header).toHaveAttribute("data-hidden", "false");
        expect(
          await scroll.evaluate(
            (node) => node.firstElementChild!.getBoundingClientRect().top,
          ),
        ).toBe(44);
      });
    }

    /** Полоса прогресса вопроса остаётся частью общего scroll, а не отдельной фиксированной полосой. */
    test("quiz progress also scrolls away, leaving no fixed strip", async ({
      page,
    }) => {
      await layoutApi(page, true);
      await gotoWithSession(page, "/quiz");
      await page.getByRole("button", { name: "Начать путешествие" }).click();
      const scroll = page.locator(scrollSelector).first();
      await expect(scroll).toBeVisible();
      // The question's progress row is part of the same scroller as its answers.
      await expect(scroll.locator('[class*="progressContainer"]')).toHaveCount(
        1,
      );
      await scroll.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect(page.locator(headerSelector)).toHaveAttribute(
        "data-hidden",
        "true",
      );
      await expect(
        scroll.locator('[class*="progressContainer"]'),
      ).not.toBeInViewport();
    });
  });
}
