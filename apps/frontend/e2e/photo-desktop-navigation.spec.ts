import { expect, test, type Locator, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

async function fixtures(page: Page, count = 10) {
  const photos = Array.from(
    { length: count },
    (_, i) => `https://photo-navigation.example.test/${i + 1}.svg`,
  );
  await editorApi(page, (name) =>
    name === "feed.listPaginated"
      ? ok({
          posts: [
            {
              id: 1,
              text: "PHOTO_NAVIGATION",
              photos,
              media: [],
              tags: [],
              target: "feed",
              likeCount: 0,
              commentCount: 0,
              createdAt: "2026-10-13T10:00:00Z",
            },
          ],
          nextCursor: null,
        })
      : undefined,
  );
  await page.route("https://photo-navigation.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="beige"/></svg>',
    }),
  );
  await gotoWithSession(page, "/feed");
  const album = page.getByRole("region", { name: "Фотографии поста" });
  if (count > 9) await album.waitFor();
  return album;
}
function viewer(page: Page) {
  return page.getByRole("dialog", { name: "Просмотр фотографий" });
}
async function centered(dialog: Locator) {
  const scroll = dialog.locator(".ui-scroll-horizontal");
  await expect
    .poll(() =>
      scroll.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      }),
    )
    .toEqual({
      x: 0,
      y: 0,
      width: (await dialog.boundingBox())!.width,
      height: (await dialog.boundingBox())!.height,
      viewportWidth: (await dialog.boundingBox())!.width,
      viewportHeight: (await dialog.boundingBox())!.height,
    });
}
async function mouseDrag(page: Page, scroll: Locator, direction = -1) {
  await scroll.scrollIntoViewIfNeeded();
  const box = (await scroll.boundingBox())!;
  const x = box.x + box.width * (direction < 0 ? 0.75 : 0.25),
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + direction * box.width * 0.5, y, { steps: 12 });
  await page.mouse.up();
}

test.describe("desktop photo navigation", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
  });

  test("dragging changes the feed photo without opening it; a fresh click opens the selected photo", async ({
    page,
  }) => {
    const album = await fixtures(page);
    await mouseDrag(page, album.locator(".ui-scroll-horizontal"));
    await expect(album.getByText("2 / 10", { exact: true })).toBeVisible();
    await expect(viewer(page)).toHaveCount(0);
    await album
      .getByRole("button", { name: "Открыть фото 2 из 10", exact: true })
      .click();
    await expect(
      viewer(page).getByText("2 / 10", { exact: true }),
    ).toBeVisible();
    await centered(viewer(page));
  });

  test("feed keeps its existing controls and keyboard navigation stops at both ends", async ({
    page,
  }) => {
    const album = await fixtures(page);
    await expect(
      album.getByRole("button", {
        name: /Предыдущее фото|Следующее фото/,
        includeHidden: true,
      }),
    ).toHaveCount(0);
    await album.locator(".ui-scroll-horizontal").focus();
    await page.keyboard.press("ArrowRight");
    await expect(album.getByText("2 / 10", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(album.getByText("1 / 10", { exact: true })).toBeVisible();
    await album.locator(".ui-scroll-horizontal").focus();
    await page.keyboard.press("End");
    await expect(album.getByText("10 / 10", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(album.getByText("10 / 10", { exact: true })).toBeVisible();
    await expect(viewer(page)).toHaveCount(0);
  });

  test("viewer keys work immediately with focus on close, including Home/End and Escape", async ({
    page,
  }) => {
    const album = await fixtures(page);
    await album
      .getByRole("button", { name: "Открыть фото 1 из 10", exact: true })
      .click();
    const dialog = viewer(page);
    await expect(
      dialog.getByRole("button", { name: "Закрыть фотографии" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText("2 / 10", { exact: true })).toBeVisible();
    await page.keyboard.press("End");
    await expect(dialog.getByText("10 / 10", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Следующее фото" }),
    ).toBeDisabled();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.getByText("1 / 10", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      album.getByRole("button", { name: "Открыть фото 1 из 10", exact: true }),
    ).toBeFocused();
  });

  test("viewer arrows and mouse dragging work in both directions without moving the window", async ({
    page,
  }) => {
    const album = await fixtures(page);
    await album
      .getByRole("button", { name: "Открыть фото 1 из 10", exact: true })
      .click();
    const dialog = viewer(page);
    await dialog.getByRole("button", { name: "Следующее фото" }).click();
    await expect(dialog.getByText("2 / 10", { exact: true })).toBeVisible();
    await mouseDrag(page, dialog.locator(".ui-scroll-horizontal"));
    await expect(dialog.getByText("3 / 10", { exact: true })).toBeVisible();
    await mouseDrag(page, dialog.locator(".ui-scroll-horizontal"), 1);
    await expect(dialog.getByText("2 / 10", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Предыдущее фото" }).click();
    await expect(dialog.getByText("1 / 10", { exact: true })).toBeVisible();
    await centered(dialog);
    // Previously a downward movement followed by horizontal failure stranded translateY.
    await page.mouse.move(700, 400);
    await page.mouse.down();
    await page.mouse.move(700, 460, { steps: 6 });
    await page.mouse.move(900, 460, { steps: 10 });
    await page.mouse.up();
    await centered(dialog);
    await expect(dialog.getByText("1 / 10", { exact: true })).toBeVisible();
  });

  test("a mouse drag released outside the album still finishes and restores clicking", async ({
    page,
  }) => {
    const album = await fixtures(page);
    const scroll = album.locator(".ui-scroll-horizontal");
    await scroll.scrollIntoViewIfNeeded();
    const box = (await scroll.boundingBox())!;
    await page.mouse.move(box.x + 350, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x - 50, box.y + 200, { steps: 12 });
    await page.mouse.up();
    await expect(album.getByText("2 / 10", { exact: true })).toBeVisible();
    await expect(scroll).not.toHaveAttribute("data-photo-dragging");
    await expect(viewer(page)).toHaveCount(0);
    await album
      .getByRole("button", { name: "Открыть фото 2 из 10", exact: true })
      .click();
    await expect(viewer(page)).toBeVisible();
  });

  test("losing the window cancels a held mouse drag and restores snapping", async ({
    page,
  }) => {
    const album = await fixtures(page);
    const scroll = album.locator(".ui-scroll-horizontal");
    await scroll.scrollIntoViewIfNeeded();
    const box = (await scroll.boundingBox())!;
    await page.mouse.move(box.x + 350, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 200, { steps: 10 });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.up();
    await expect(scroll).not.toHaveAttribute("data-photo-dragging");
    await expect(scroll).toHaveCSS("scroll-snap-type", "x mandatory");
    await expect(album.getByText("1 / 10", { exact: true })).toBeVisible();
    await expect(viewer(page)).toHaveCount(0);
    await mouseDrag(page, scroll);
    await expect(album.getByText("2 / 10", { exact: true })).toBeVisible();
  });

  test("last photo stays centered after resize and repeated opening", async ({
    page,
  }) => {
    const album = await fixtures(page);
    await album.locator(".ui-scroll-horizontal").focus();
    await page.keyboard.press("End");
    await album
      .getByRole("button", { name: "Открыть фото 10 из 10", exact: true })
      .click();
    const dialog = viewer(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(dialog.getByText("10 / 10", { exact: true })).toBeVisible();
    await centered(dialog);
    await page.setViewportSize({ width: 1200, height: 750 });
    await centered(dialog);
    await dialog.getByRole("button", { name: "Закрыть фотографии" }).click();
    await album
      .getByRole("button", { name: "Открыть фото 10 из 10", exact: true })
      .click();
    await expect(dialog.getByText("10 / 10", { exact: true })).toBeVisible();
    await centered(dialog);
  });

  test("single photo has no navigation controls", async ({ page }) => {
    await fixtures(page, 1);
    await page
      .getByRole("button", { name: "Открыть фото", exact: true })
      .click();
    const dialog = viewer(page);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Следующее фото" }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Предыдущее фото" }),
    ).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await centered(dialog);
  });
});

test.describe("mobile photo gestures", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("desktop arrows stay hidden on touch screens", async ({ page }) => {
    const album = await fixtures(page);
    await expect(
      album.getByRole("button", {
        name: "Следующее фото",
        includeHidden: true,
      }),
    ).toHaveCount(0);
    await album
      .getByRole("button", { name: "Открыть фото 1 из 10", exact: true })
      .tap();
    await expect(
      viewer(page).getByRole("button", {
        name: "Следующее фото",
        includeHidden: true,
      }),
    ).toBeHidden();
    await centered(viewer(page));
  });

  test("native swipes, canceled diagonal gestures and downward dismissal", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Native touch movement is sent through Chromium CDP.",
    );
    const album = await fixtures(page);
    const scroll = album.locator(".ui-scroll-horizontal");
    await scroll.scrollIntoViewIfNeeded();
    const box = (await scroll.boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const touch = async (
      type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
      x = 0,
      y = 0,
    ) => {
      await session.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
          type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y }],
      });
    };
    const swipe = async (y: number) => {
      await touch("touchStart", 350, y);
      for (let i = 1; i <= 10; i++) {
        await touch("touchMove", 350 - i * 32, y);
        await page.waitForTimeout(20);
      }
      await touch("touchEnd");
    };
    await swipe(box.y + box.height / 2);
    await expect(album.getByText("2 / 10", { exact: true })).toBeVisible();
    await expect(viewer(page)).toHaveCount(0);
    await album
      .getByRole("button", { name: "Открыть фото 2 из 10", exact: true })
      .tap();
    const dialog = viewer(page);
    await swipe(420);
    await expect(dialog.getByText("3 / 10", { exact: true })).toBeVisible();
    for (const canceled of [false, true]) {
      await touch("touchStart", 190, 420);
      for (let i = 1; i <= 6; i++) {
        await touch("touchMove", 190, 420 + i * 10);
        await page.waitForTimeout(20);
      }
      if (canceled) await touch("touchCancel");
      else {
        for (let i = 1; i <= 8; i++) {
          await touch("touchMove", 190 + i * 10, 480);
          await page.waitForTimeout(20);
        }
        await touch("touchEnd");
      }
      await centered(dialog);
    }
    await touch("touchStart", 190, 420);
    for (let i = 1; i <= 12; i++) {
      await touch("touchMove", 190, 420 + i * 16);
      await page.waitForTimeout(20);
    }
    await touch("touchEnd");
    await expect(dialog).toHaveCount(0);
  });
});
