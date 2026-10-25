import { expect, test, type Locator, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, hasTouch: false });

async function fixture(page: Page, path: string) {
  const photos = Array.from(
    { length: 4 },
    (_, i) =>
      new URL(
        `/assets/carousel-fix/${i}.svg`,
        String(test.info().project.use.baseURL),
      ).href,
  );
  await editorApi(page, (name) =>
    name === "articles.getById"
      ? ok({
          id: 42,
          title: "DRAG_ARTICLE",
          access: "public",
          coverUrl: null,
          locked: false,
          sections: [{ type: "carousel", urls: photos }],
        })
      : undefined,
  );
  await page.route("**/assets/carousel-fix/*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#8b7355"/></svg>',
    }),
  );
  await gotoWithSession(page, path);
  return page.locator("main .ui-scroll-horizontal").first();
}

async function drag(
  page: Page,
  scroll: Locator,
  direction = -1,
  outside = false,
) {
  await scroll.scrollIntoViewIfNeeded();
  const box = (await scroll.boundingBox())!;
  const x = box.x + box.width * (direction < 0 ? 0.8 : 0.2);
  const y = box.y + Math.min(box.height / 2, 180);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    outside ? box.x - 20 : x + direction * box.width * 0.6,
    y,
    { steps: 12 },
  );
  await page.mouse.up();
}

async function noDim(page: Page, button: Locator) {
  await button.scrollIntoViewIfNeeded();
  const photo = await button.locator("img").last().elementHandle();
  const src = await photo!.evaluate(
    (el) => (el as HTMLImageElement).currentSrc,
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") requests.push(request.url());
  });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await expect(button).toHaveCSS("opacity", "1");
    expect(await photo!.evaluate((el) => el.isConnected)).toBe(true);
    expect(
      await photo!.evaluate((el) => (el as HTMLImageElement).currentSrc),
    ).toBe(src);
    expect(requests).not.toContain(src);
  } finally {
    // Releasing outside is a cancelled click, not an accidental navigation.
    await page.mouse.move(box.x - 20, box.y - 20);
    await page.mouse.up();
  }
}

test("home promo does not dim or reload the image on mouse press", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/");
  await noDim(page, page.getByRole("button", { name: /^Перейти: / }));
});

test("gallery photo does not dim or reload on mouse press", async ({
  page,
}) => {
  const scroll = await fixture(page, "/shop/book-1");
  await noDim(page, scroll.getByRole("button").first());
});

for (const path of [
  "/shop/book-1",
  "/library/about-me",
  "/library/article/42",
]) {
  test(`mouse drag scrolls ${path} without opening a photo; a fresh click still opens it`, async ({
    page,
  }) => {
    const scroll = await fixture(page, path);
    await drag(page, scroll);
    await expect
      .poll(() => scroll.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(80);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(path);
    await drag(page, scroll, 1);
    await expect
      .poll(() => scroll.evaluate((el) => el.scrollLeft))
      .toBeLessThan(40);
    await scroll.getByRole("button").first().click();
    await expect(
      page.getByRole("dialog").filter({ visible: true }),
    ).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog").filter({ visible: true }),
    ).toHaveCount(0);
  });
}

test("a short mouse movement remains a click; blur cancels a swipe and outside release completes it", async ({
  page,
}) => {
  const scroll = await fixture(page, "/library/about-me");
  await scroll.scrollIntoViewIfNeeded();
  const box = (await scroll.boundingBox())!;
  const x = box.x + box.width * 0.75,
    y = box.y + 120;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 2, y);
  await page.mouse.up();
  await expect(
    page.getByRole("dialog", { name: "Просмотр фотографий" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 180, y, { steps: 10 });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await drag(page, scroll, -1, true);
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(80);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await scroll.evaluate((el) => el.style.scrollSnapType)).toBe(
    "x mandatory",
  );
});

test("testimonial dragging preserves its previous and next buttons", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/club");
  const scroll = page
    .getByLabel("Письма участниц — листайте в стороны", { exact: true })
    .first();
  const section = scroll.locator("..");
  await drag(page, scroll);
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(80);
  await section
    .getByRole("button", { name: "Предыдущий отзыв", exact: true })
    .click();
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeLessThan(5);
  await section
    .getByRole("button", { name: "Следующий отзыв", exact: true })
    .click();
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(80);
});

test("dragging quiz image choices never selects an answer; a normal click does", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/quiz");
  await page
    .getByRole("button", { name: "Начать путешествие", exact: true })
    .click();
  for (let q = 1; q <= 5; q++) {
    if (q === 3 || q === 5) {
      const scroll = page.locator("main .ui-scroll-horizontal");
      await drag(page, scroll);
      await expect
        .poll(() => scroll.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(80);
      await expect(
        page.locator('main button[aria-pressed="true"]'),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Выбрать изображение 2", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Выбрать изображение 2",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
    } else await page.locator("main button[aria-pressed]").first().click();
    if (q < 5)
      await page.getByRole("button", { name: "Далее →", exact: true }).click();
  }
});

test("mouse swiping preserves native keyboard and horizontal wheel scrolling", async ({
  page,
}) => {
  const scroll = await fixture(page, "/shop/book-1");
  await scroll.scrollIntoViewIfNeeded();
  await scroll.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(10);
  await scroll.evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(0);
  await scroll.hover();
  await page.mouse.wheel(450, 0);
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(80);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("native touch on galleries with mouse swiping", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  for (const path of ["/shop/book-1", "/library/about-me"]) {
    test(`${path}: native swipes and a fresh tap still work`, async ({
      page,
    }) => {
      const scroll = await fixture(page, path);
      await scroll.scrollIntoViewIfNeeded();
      const box = (await scroll.boundingBox())!;
      const session = await page.context().newCDPSession(page);
      const x = box.x + box.width * 0.85,
        y = box.y + 150;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 12; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x - (230 * step) / 12, y }],
        });
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await session.detach();
      await expect
        .poll(() => scroll.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(80);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // Allow Chromium's compatibility-click suppression after a native fling to expire.
      await page.waitForTimeout(1200);
      await scroll.getByRole("button").nth(1).tap();
      await expect(
        page.getByRole("dialog").filter({ visible: true }),
      ).toHaveCount(1);
    });
  }
});
