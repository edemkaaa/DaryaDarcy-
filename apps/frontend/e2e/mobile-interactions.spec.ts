import { expect, test, type Locator, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

const photos = Array.from(
  { length: 10 },
  (_, index) => `https://gesture.example.test/${index + 1}.svg`,
);
const video = {
  id: 1,
  youtubeId: "gesture-video",
  title: "GESTURE_VIDEO",
  thumbnailUrl: photos[0],
  videoUrl: null,
  description: "Проверка жестов",
  duration: "10:00",
  published: true,
};
async function fixtures(page: Page) {
  await editorApi(page, (name) => {
    if (name === "videos.list")
      return ok(
        Array.from({ length: 12 }, (_, i) => ({ ...video, id: i + 1 })),
      );
    if (name === "videos.getById") return ok(video);
    if (name === "club.subscription")
      return ok({
        hasClubAccess: true,
        subscribed: true,
        cancelAtPeriodEnd: false,
        expiresAt: null,
        isOwner: true,
        monthlyPrice: "790",
      });
    if (name === "feed.listPaginated")
      return ok({
        posts: [
          {
            id: 1,
            text: "GESTURE_ALBUM",
            photos,
            media: [],
            tags: [],
            target: "feed",
            likeCount: 0,
            commentCount: 0,
            createdAt: "2026-10-09T10:00:00Z",
          },
        ],
        nextCursor: null,
      });
  });
  await page.route("https://gesture.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="beige"/></svg>',
    }),
  );
}
async function touch(page: Page) {
  const session = await page.context().newCDPSession(page);
  return {
    start: (x: number, y: number) =>
      session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      }),
    move: (x: number, y: number) =>
      session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      }),
    end: () =>
      session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      }),
    cancel: () =>
      session.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      }),
  };
}
async function center(control: Locator) {
  await control.click({ trial: true });
  const box = (await control.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("touching and swiping a video card preserves its appearance and native scrolling; a fresh tap opens it", async ({
  page,
}) => {
  await fixtures(page);
  await gotoWithSession(page, "/videos");
  const card = page.getByRole("button", { name: /GESTURE_VIDEO/ }).first();
  const point = await center(card);
  const before = await card.evaluate((el) => ({
    opacity: getComputedStyle(el).opacity,
    transform: getComputedStyle(el).transform,
  }));
  const finger = await touch(page);
  await finger.start(point.x, point.y);
  await expect
    .poll(() =>
      card.evaluate((el) => ({
        opacity: getComputedStyle(el).opacity,
        transform: getComputedStyle(el).transform,
      })),
    )
    .toEqual(before);
  for (let step = 1; step <= 8; step++) {
    await finger.move(point.x, point.y - step * 20);
    await page.waitForTimeout(20);
  }
  await finger.end();
  await expect(page).toHaveURL(/\/videos$/);
  await expect
    .poll(() =>
      page
        .locator("main .ui-scroll:visible")
        .first()
        .evaluate((el) => el.scrollTop),
    )
    .toBeGreaterThan(50);
  await card.tap();
  await expect(page).toHaveURL(/\/video\/1$/);
});

test("touch navigation cards do not scale or dim, and canceled movement cannot open a link", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/");
  const link = page.locator(".ui-navigation-card:visible").first();
  const point = await center(link);
  const before = await link.evaluate((el) => ({
    opacity: getComputedStyle(el).opacity,
    transform: getComputedStyle(el.firstElementChild!).transform,
  }));
  const finger = await touch(page);
  await finger.start(point.x, point.y);
  expect(
    await link.evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      transform: getComputedStyle(el.firstElementChild!).transform,
    })),
  ).toEqual(before);
  await finger.cancel();
  await expect(page).toHaveURL(/\/$/);
  const destination = await link.getAttribute("href");
  await link.tap();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
});

test("a shelf touch has no press animation and a fresh tap still opens the product", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/shop");
  const book = page.getByRole("button", { name: /Открыть товар:/ }).first();
  const point = await center(book);
  const motion = book.locator(":scope > div");
  const before = await motion.evaluate((el) => getComputedStyle(el).transform);
  const finger = await touch(page);
  await finger.start(point.x, point.y);
  await page.waitForTimeout(150); // The former shelf press animation took 100 ms.
  expect(await motion.evaluate((el) => getComputedStyle(el).transform)).toBe(
    before,
  );
  await finger.move(point.x, point.y - 90);
  await finger.end();
  await expect(page).toHaveURL(/\/shop$/);
  await book.tap();
  await expect(page).toHaveURL(/\/shop\/book-1$/);
});

test("native horizontal photo swipes change the slide without opening the viewer, and a tap opens it", async ({
  page,
}) => {
  await fixtures(page);
  await gotoWithSession(page, "/feed");
  const album = page.getByRole("region", { name: "Фотографии поста" });
  const scroll = album.locator(".ui-scroll-horizontal");
  await scroll.scrollIntoViewIfNeeded();
  const box = (await scroll.boundingBox())!;
  const finger = await touch(page);
  const y = box.y + box.height / 2;
  await finger.start(box.x + box.width - 30, y);
  for (let step = 1; step <= 10; step++) {
    await finger.move(
      box.x + box.width - 30 - ((box.width - 60) * step) / 10,
      y,
    );
    await page.waitForTimeout(20);
  }
  await finger.end();
  await expect(album.getByText("2 / 10", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Просмотр фотографий" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/feed$/);
  await album.getByRole("button", { name: "Открыть фото 2 из 10" }).tap();
  await expect(
    page.getByRole("dialog", { name: "Просмотр фотографий" }),
  ).toBeVisible();
});

test("moving off a held action cancels its timer; a stationary hold retains the existing action", async ({
  page,
}) => {
  await fixtures(page);
  await gotoWithSession(page, "/feed");
  const action = page.getByRole("button", { name: "Новый пост", exact: true });
  const point = await center(action);
  const finger = await touch(page);
  await finger.start(point.x, point.y);
  await finger.move(point.x + 18, point.y - 18);
  await page.waitForTimeout(600); // Deliberately exceed the existing hold delay.
  await finger.end();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(
    page.getByRole("dialog", { name: "Редактор публикации" }),
  ).toHaveCount(0);
  await finger.start(point.x, point.y);
  await page.waitForTimeout(600);
  await finger.end();
  await expect(page).toHaveURL(/\/admin$/);
});

test("a compatibility click after a moved touch is blocked, while the next tap and keyboard activation work", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/");
  const link = page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Видео" });
  await link.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 30,
    clientY: 800,
  });
  await link.dispatchEvent("pointermove", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 50,
    clientY: 800,
  });
  await link.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 50,
    clientY: 800,
  });
  await link.dispatchEvent("click", { detail: 1 });
  await expect(page).toHaveURL(/\/$/);
  await link.tap();
  await expect(page).toHaveURL(/\/videos$/);
  const library = page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Библиотека" });
  await library.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/library$/);
});

test("mouse press feedback and keyboard activation of actions remain available", async ({
  page,
}) => {
  await fixtures(page);
  await gotoWithSession(page, "/videos");
  const card = page.getByRole("button", { name: /GESTURE_VIDEO/ }).first();
  const point = await center(card);
  const opacity = await card.evaluate((el) =>
    Number(getComputedStyle(el).opacity),
  );
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect
    .poll(() => card.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBeLessThan(opacity);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/video\/1$/);
  await gotoWithSession(page, "/videos");
  const again = page.getByRole("button", { name: /GESTURE_VIDEO/ }).first();
  await again.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/video\/1$/);
});

test("small finger movement preserves a tap and a native file chooser in the editor", async ({
  page,
}) => {
  await fixtures(page);
  await gotoWithSession(page, "/feed");
  const action = page.getByRole("button", { name: "Новый пост", exact: true });
  const point = await center(action);
  const finger = await touch(page);
  await finger.start(point.x, point.y);
  await finger.move(point.x + 3, point.y + 3);
  await finger.end();
  const form = page.getByRole("dialog", { name: "Редактор публикации" });
  await expect(
    form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await form.getByRole("button", { name: "Аудио", exact: true }).tap();
  await (
    await chooser
  ).setFiles({
    name: "chosen.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("fixture attachment"),
  });
  await expect(form.getByText("chosen.mp3", { exact: true })).toBeVisible();
});

test("two-finger zoom in the pattern viewer and the following close tap still work", async ({
  page,
}) => {
  await layoutApi(page, true);
  await gotoWithSession(page, "/library/patterns");
  await page
    .getByRole("button", { name: /Открыть выкройку:/ })
    .first()
    .tap();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const image = dialog.locator('div[style*="scale("]');
  await expect(image).toHaveCount(1);
  const box = (await image.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: x - 30, y },
      { id: 2, x: x + 30, y },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { id: 1, x: x - 60, y },
      { id: 2, x: x + 60, y },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() =>
      image.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a),
    )
    .toBeGreaterThan(1.5);
  await dialog.getByRole("button", { name: "Закрыть просмотр выкройки" }).tap();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/library\/patterns$/);
});
