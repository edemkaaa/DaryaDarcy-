import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

async function data(page: Page, member: boolean) {
  await layoutApi(page, member);
  await page.route("**/api/trpc/videos.list*", (route) =>
    route.fulfill({
      json: [
        {
          result: {
            data: {
              json: Array.from({ length: 12 }, (_, i) => ({
                id: i + 1,
                youtubeId: `fixture-${i}`,
                title: `Видео ${i}`,
                thumbnailUrl: null,
                duration: "10:00",
              })),
            },
          },
        },
      ],
    }),
  );
  await page.route("**/api/trpc/articles.getById*", (route) =>
    route.fulfill({
      json: [
        {
          result: {
            data: {
              json: {
                id: 1,
                title: "Статья",
                access: "public",
                locked: false,
                sections: [
                  { type: "text", text: "Содержимое статьи. ".repeat(120) },
                ],
              },
            },
          },
        },
      ],
    }),
  );
}

async function ending(page: Page, path: string) {
  await gotoWithSession(page, path);
  const scroll = page
    .locator("main .ui-scroll:not(.ui-scroll-horizontal):visible")
    .first();
  await expect(scroll).toBeVisible();
  await scroll.evaluate(async (el) => {
    await document.fonts.ready;
    el.scrollTop = el.scrollHeight;
  });
  await expect
    .poll(() =>
      scroll.evaluate((el) =>
        Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop),
      ),
    )
    .toBeLessThan(2);
  const measure = () =>
    scroll.evaluate((el) => {
      const menu = document
        .querySelector('nav[aria-label="Разделы"]')!
        .getBoundingClientRect();
      const controls = Array.from(
        el.querySelectorAll<HTMLElement>(".ui-text,button,a,video"),
      ).filter((node) => {
        const box = node.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          !node.closest("[hidden],[inert]") &&
          getComputedStyle(node).visibility !== "hidden"
        );
      });
      const bottom = Math.max(
        ...controls.map((node) => node.getBoundingClientRect().bottom),
      );
      return {
        gap: menu.top - bottom,
        scrollBottom: el.getBoundingClientRect().bottom,
        menuTop: menu.top,
        menuBottom: menu.bottom,
        viewport: innerHeight,
      };
    });
  return { scroll, measure };
}

for (const [width, height] of [
  [320, 400],
  [390, 844],
  [1440, 900],
]) {
  for (const [path, member] of [
    ["/library", false],
    ["/library/about-me", false],
    ["/library/aesthetics-guide", true],
    ["/library/patterns", true],
    ["/library/article/1", false],
    ["/shop", false],
    ["/shop/digital-1", false],
    ["/shop/digital-2", false],
    ["/shop/book-1", false],
    ["/club", false],
    ["/profile", true],
    ["/videos", false],
  ] as const) {
    test(`${path} keeps a modest visible gap above the menu at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await data(page, member);
      const { measure } = await ending(page, path);
      await expect
        .poll(async () => (await measure()).gap)
        .toBeGreaterThanOrEqual(16);
      await expect
        .poll(async () => (await measure()).gap)
        .toBeLessThanOrEqual(80);
      const bounds = await measure();
      expect(bounds.scrollBottom).toBeCloseTo(bounds.menuTop, 0);
      expect(bounds.menuBottom).toBeCloseTo(bounds.viewport, 0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test("the club list retains clearance above its overlaid section menu", async ({
  page,
}) => {
  await data(page, true);
  const { scroll } = await ending(page, "/club");
  const geometry = await scroll.evaluate((el) => {
    const sections = document
      .querySelector('[class*="clubTabBar"]')!
      .getBoundingClientRect();
    const cards = Array.from(
      el.querySelectorAll<HTMLElement>(".ui-text,button,a"),
    );
    const bottom = Math.max(
      ...cards.map((node) => node.getBoundingClientRect().bottom),
    );
    return {
      gap: sections.top - bottom,
      menuBottom: sections.bottom,
      globalMenuTop: document
        .querySelector('nav[aria-label="Разделы"]')!
        .getBoundingClientRect().top,
    };
  });
  expect(geometry.gap).toBeGreaterThanOrEqual(16);
  expect(geometry.menuBottom).toBeCloseTo(geometry.globalMenuTop, 0);
});

test("safe-area growth reserves space in the menu without doubling the page gap", async ({
  page,
}) => {
  await data(page, false);
  const { measure } = await ending(page, "/library");
  const before = await measure();
  await page.addStyleTag({
    content: 'nav[aria-label="Разделы"] {height: 96px; padding-bottom: 34px;}',
  });
  const scroll = page
    .locator("main .ui-scroll:not(.ui-scroll-horizontal):visible")
    .first();
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect
    .poll(async () => Math.abs((await measure()).gap - before.gap))
    .toBeLessThan(2);
  const after = await measure();
  expect(after.menuTop).toBeCloseTo(before.menuTop - 20, 0);
  expect(after.menuBottom).toBeCloseTo(after.viewport, 0);
});

test("a shorter viewport keeps the login inputs and final action reachable", async ({
  page,
}) => {
  await data(page, false);
  await gotoWithSession(page, "/login");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await email.fill("member@example.test");
  await email.focus();
  await page.setViewportSize({ width: 390, height: 360 });
  await email.scrollIntoViewIfNeeded();
  await expect(email).toBeInViewport();
  const back = page
    .locator("main")
    .getByRole("button", { name: "Назад", exact: true });
  await back.scrollIntoViewIfNeeded();
  const menu = (await page
    .getByRole("navigation", { name: "Разделы" })
    .boundingBox())!;
  const button = (await back.boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(menu.y - 16);
  await expect(email).toHaveValue("member@example.test");
});
