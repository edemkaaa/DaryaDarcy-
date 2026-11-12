import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

/** A small deterministic picture makes zoom and crop boundaries visible without real user media. */
async function picture(page: Page, width = 800, height = 800) {
  return Buffer.from(
    await page.evaluate(
      ({ width, height }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d")!;
        const colors = ["#b6c89c", "#e9bb87", "#9db7ce", "#c99aa5"];
        for (let i = 0; i < 4; i++) {
          const x = ((i % 2) * width) / 2,
            y = (Math.floor(i / 2) * height) / 2;
          context.fillStyle = colors[i];
          context.fillRect(x, y, width / 2, height / 2);
          context.fillStyle = "#4a3728";
          context.font = "bold 60px sans-serif";
          context.fillText(
            String.fromCharCode(65 + i),
            x + width / 5,
            y + height / 3,
          );
        }
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { width, height },
    ),
    "base64",
  );
}
async function capture(page: Page, name: string) {
  if (process.env.MEDIA_SCREENSHOTS)
    await page.screenshot({
      path: join(process.env.MEDIA_SCREENSHOTS, `${name}.png`),
      animations: "disabled",
    });
}
async function fingers(page: Page) {
  const session = await page.context().newCDPSession(page);
  return (
    type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
    points: { id: number; x: number; y: number }[] = [],
  ) => session.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}
async function pinch(page: Page, x: number, y: number, factor: number) {
  const touch = await fingers(page);
  await touch("touchStart", [
    { id: 1, x: x - 35, y },
    { id: 2, x: x + 35, y },
  ]);
  for (let step = 1; step <= 8; step++) {
    const distance = 35 * (1 + ((factor - 1) * step) / 8);
    await touch("touchMove", [
      { id: 1, x: x - distance, y },
      { id: 2, x: x + distance, y },
    ]);
  }
  await touch("touchEnd");
}

async function openPhotos(page: Page) {
  const png = await picture(page);
  await layoutApi(page, false, (name) =>
    name === "feed.getById"
      ? ok({
          id: 77,
          text: "ZOOM_CHECK",
          target: "feed",
          photos: [
            "https://media-audit.example.test/one.png",
            "https://media-audit.example.test/two.png",
          ],
          media: [],
          tags: [],
          richText: null,
          likeCount: 0,
          commentCount: 0,
          createdAt: "2026-10-01T10:00:00Z",
          publishedAt: null,
        })
      : undefined,
  );
  await page.route("https://media-audit.example.test/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await gotoWithSession(page, "/post/77");
  await page
    .getByRole("button", { name: /Открыть фото/ })
    .first()
    .tap();
  return page.getByRole("dialog", { name: "Просмотр фотографий" });
}

/** Guest photo viewing is public; only the image may scale, not the viewport or close control. */
test("pinch enlarges only the active photo and keeps the close control stable", async ({
  page,
}) => {
  const dialog = await openPhotos(page);
  const image = dialog.locator("img").first();
  await expect(image).toBeVisible();
  const before = (await image.boundingBox())!;
  const close = dialog.getByRole("button", { name: "Закрыть фотографии" });
  const closeBefore = await close.boundingBox();
  await pinch(page, 195, 400, 2);
  try {
    await expect
      .poll(async () => (await image.boundingBox())!.width)
      .toBeGreaterThan(before.width * 1.5);
  } finally {
    await capture(page, "F05-photo-pinch");
  }
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
  expect(await close.boundingBox()).toEqual(closeBefore);
  await close.tap();
  await expect(dialog).toHaveCount(0);
});

/** Protected patterns use synthetic bindings and decoded PNG content. */
async function openPattern(page: Page) {
  const png = await picture(page, 600, 800);
  await layoutApi(page, true);
  await page.route("**/api/library/materials/patterns/files", (route) =>
    route.fulfill({
      json: {
        files: [
          {
            fileKey: "holly",
            sortOrder: 0,
            revision: 1,
            filename: "holly.png",
            mimeType: "image/png",
            fileSize: png.length,
            url: "/api/media/library-files/patterns/holly",
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route("**/api/media/library-files/patterns/holly", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await gotoWithSession(page, "/library/patterns");
  await page
    .getByRole("button", { name: /Открыть выкройку:/ })
    .first()
    .tap();
  return page.getByRole("dialog");
}

test("a pattern double tap zooms and a drag cannot become a second tap", async ({
  page,
}) => {
  const dialog = await openPattern(page);
  const image = dialog.locator('div[style*="scale("]');
  const box = (await image.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
  const scale = () =>
    image.evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).a,
    );
  try {
    await expect.poll(scale).toBeCloseTo(2.5, 1);
  } finally {
    await capture(page, "F06-pattern-double-tap");
  }
  const touch = await fingers(page);
  await touch("touchStart", [{ id: 1, x, y }]);
  await touch("touchMove", [{ id: 1, x: x + 50, y }]);
  await touch("touchEnd");
  await page.touchscreen.tap(x, y);
  expect(await scale()).toBeCloseTo(2.5, 1);
  await dialog.getByRole("button", { name: "Закрыть просмотр выкройки" }).tap();
  await expect(dialog).toHaveCount(0);
});

for (const [name, width, height] of [
  ["square", 800, 800],
  ["wide", 1000, 500],
  ["tall", 500, 1000],
  ["unmoved-touch", 800, 800],
  ["zoomed-wide", 1000, 500],
] as const) {
  test(`${name}: avatar preview stays covered and matches the saved crop`, async ({
    page,
  }) => {
    const png = await picture(page, width, height);
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.drawImage;
      Object.defineProperty(CanvasRenderingContext2D.prototype, "drawImage", {
        configurable: true,
        value: function (this: CanvasRenderingContext2D, ...args: unknown[]) {
          if (args.length === 9 && args[7] === 400 && args[8] === 400)
            (window as Window & { cropDraw?: number[] }).cropDraw = args.slice(
              1,
              5,
            ) as number[];
          return Reflect.apply(original, this, args);
        },
      });
    });
    await editorApi(page);
    await gotoWithSession(page, "/profile");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Выбрать фото профиля", exact: true })
      .tap();
    await (
      await chooser
    ).setFiles({ name: "crop.png", mimeType: "image/png", buffer: png });
    const frame = page.locator('[class*="circleFrame"]');
    await expect(frame).toBeVisible();
    const circle = (await frame.boundingBox())!;
    if (name === "zoomed-wide")
      await pinch(
        page,
        circle.x + circle.width / 2,
        circle.y + circle.height / 2,
        2,
      );
    const touch = await fingers(page);
    if (name !== "unmoved-touch") {
      await touch("touchStart", [
        {
          id: 1,
          x: circle.x + circle.width / 2,
          y: circle.y + circle.height / 2,
        },
      ]);
      await touch("touchMove", [
        {
          id: 1,
          x: circle.x + circle.width / 2 + 160,
          y: circle.y + circle.height / 2 + 100,
        },
      ]);
      await touch("touchEnd");
    }
    await capture(page, `F07-avatar-${name}`);
    const image = (await frame.locator("img").boundingBox())!;
    expect(image.x).toBeLessThanOrEqual(circle.x + 2);
    expect(image.y).toBeLessThanOrEqual(circle.y + 2);
    expect(image.x + image.width).toBeGreaterThanOrEqual(
      circle.x + circle.width - 2,
    );
    expect(image.y + image.height).toBeGreaterThanOrEqual(
      circle.y + circle.height - 2,
    );
    const expected = [
      Math.round(((circle.x - image.x) * width) / image.width),
      Math.round(((circle.y - image.y) * height) / image.height),
      Math.round((circle.width * width) / image.width),
      Math.round((circle.width * width) / image.width),
    ];
    const ready = page.getByRole("button", { name: "Готово", exact: true });
    // CDP drag suppresses subsequent compatibility clicks even without app code.
    if (name === "unmoved-touch") await ready.tap();
    else await ready.press("Enter");
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { cropDraw?: number[] }).cropDraw,
        ),
      )
      .toEqual(expected);
  });
}

/** Pinch handoff must use the remaining finger as a new pan origin, for either release order. */
for (const released of [1, 2]) {
  test(`pattern pinch hands off without a jump when finger ${released} lifts`, async ({
    page,
  }) => {
    const dialog = await openPattern(page);
    const image = dialog.locator('div[style*="scale("]');
    const box = (await image.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const touch = await fingers(page);
    await image.evaluate((el) => {
      el.dataset.testPointers = "";
      el.addEventListener("pointerdown", (event) => {
        el.dataset.testPointers += `${(event as PointerEvent).pointerId},`;
      });
    });
    await touch("touchStart", [
      { id: 1, x: x - 30, y },
      { id: 2, x: x + 30, y },
    ]);
    await touch("touchMove", [
      { id: 1, x: x - 60, y },
      { id: 2, x: x + 60, y },
    ]);
    const id = released === 1 ? 2 : 1;
    const remainingX = x + (id === 1 ? -60 : 60);
    // CDP touchEnd releases all contacts; replay one pointerup to exercise handoff.
    const pointerIds = await image.evaluate((el) =>
      el.dataset.testPointers!.split(",").filter(Boolean).map(Number),
    );
    expect(pointerIds).toHaveLength(2);
    await image.evaluate(
      (el, point) =>
        el.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            pointerType: "touch",
            pointerId: point.id,
            clientX: point.x,
            clientY: point.y,
          }),
        ),
      { id: pointerIds[released - 1], x: x + (released === 1 ? -60 : 60), y },
    );
    const before = await image.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { x: m.m41, y: m.m42, scale: m.a };
    });
    await touch("touchMove", [
      { id: released, x: x + (released === 1 ? -60 : 60), y },
      { id, x: remainingX + 10, y: y + 8 },
    ]);
    await touch("touchEnd");
    await expect
      .poll(() =>
        image.evaluate((el) => {
          const m = new DOMMatrix(getComputedStyle(el).transform);
          return { x: m.m41, y: m.m42, scale: m.a };
        }),
      )
      .toEqual({ x: before.x + 10, y: before.y + 8, scale: before.scale });
    await dialog
      .getByRole("button", { name: "Закрыть просмотр выкройки" })
      .press("Enter");
    await expect(dialog).toHaveCount(0);
  });
}

test("zoomed photo pans without dismissing and resets on photo change and resize", async ({
  page,
}) => {
  const dialog = await openPhotos(page);
  await pinch(page, 195, 400, 2);
  const active = () => dialog.locator('[data-photo-zoom="active"]');
  await expect
    .poll(() =>
      active().evaluate(
        (el) => new DOMMatrix(getComputedStyle(el).transform).a,
      ),
    )
    .toBeCloseTo(2, 1);
  const touch = await fingers(page);
  await touch("touchStart", [{ id: 1, x: 195, y: 400 }]);
  await touch("touchMove", [{ id: 1, x: 225, y: 420 }]);
  await touch("touchEnd");
  await expect
    .poll(() =>
      active().evaluate(
        (el) => new DOMMatrix(getComputedStyle(el).transform).m41,
      ),
    )
    .toBe(30);
  await expect(dialog).toBeVisible();
  await pinch(page, 195, 400, 3);
  await expect
    .poll(() =>
      active().evaluate(
        (el) => new DOMMatrix(getComputedStyle(el).transform).a,
      ),
    )
    .toBe(4);
  await pinch(page, 195, 400, 0.1);
  await expect
    .poll(() =>
      active().evaluate(
        (el) => new DOMMatrix(getComputedStyle(el).transform).a,
      ),
    )
    .toBe(1);
  await pinch(page, 195, 400, 2);
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("2 / 2", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      active().evaluate(
        (el) => new DOMMatrix(getComputedStyle(el).transform).a,
      ),
    )
    .toBe(1);
  await pinch(page, 195, 400, 2);
  await expect
    .poll(() =>
      active().evaluate(
        (el) => new DOMMatrix(getComputedStyle(el).transform).a,
      ),
    )
    .toBeCloseTo(2, 1);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(() =>
      active().evaluate(
        (el) => new DOMMatrix(getComputedStyle(el).transform).a,
      ),
    )
    .toBe(1);
  await expect(dialog.getByText("2 / 2", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

/** Общий Pan с удержанием должен завершать перестановку один раз и возвращать плитку на место при отмене. */
for (const cancelled of [false, true]) {
  test(`photo editor long press ${cancelled ? "cancels without reordering" : "reorders once"}`, async ({
    page,
  }) => {
    const png = await picture(page);
    const post = {
      id: 77,
      text: "REORDER_CHECK",
      photos: [
        "https://media-audit.example.test/one.png",
        "https://media-audit.example.test/two.png",
      ],
      media: [],
      tags: [],
      richText: null,
      target: "feed",
      status: "published",
      published: true,
      editRevision: "revision:77",
      likeCount: 0,
      commentCount: 0,
      createdAt: "2026-10-01T10:00:00Z",
      publishedAt: "2026-10-01T10:00:00Z",
      scheduledAt: null,
    };
    const writes: string[] = [];
    await editorApi(page, (name) => {
      if (name === "feed.listPaginated")
        return ok({ posts: [post], nextCursor: null });
      if (name === "admin.postDetail") return ok(post);
      if (name === "admin.updatePost") writes.push(name);
    });
    await page.route("https://media-audit.example.test/**", (route) =>
      route.fulfill({ contentType: "image/png", body: png }),
    );
    await gotoWithSession(page, "/feed");
    await page
      .getByRole("button", { name: "Действия с постом", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Редактировать пост", exact: true })
      .click();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    const tiles = form.locator('[data-photo-drag="1"] [data-photo-drag="1"]');
    await expect(tiles).toHaveCount(2);
    await tiles.first().scrollIntoViewIfNeeded();
    const [first, second] = [
      (await tiles.nth(0).boundingBox())!,
      (await tiles.nth(1).boundingBox())!,
    ];
    const touch = await fingers(page);
    await touch("touchStart", [
      { id: 1, x: first.x + first.width / 2, y: first.y + first.height / 2 },
    ]);
    const tileScale = () =>
      tiles
        .first()
        .evaluate(
          (el) =>
            new DOMMatrix(
              getComputedStyle(el.parentElement!.parentElement!).transform,
            ).a,
        );
    await expect.poll(tileScale).toBeGreaterThan(1);
    await touch("touchMove", [
      {
        id: 1,
        x: second.x + second.width / 2,
        y: second.y + second.height / 2,
      },
    ]);
    await touch(cancelled ? "touchCancel" : "touchEnd");
    if (cancelled) await capture(page, "F06-photo-reorder-cancel");
    await expect.poll(tileScale).toBe(1);
    const sources = await tiles
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) => (image as HTMLImageElement).src),
      );
    expect(sources[0]).toContain(cancelled ? "one.png" : "two.png");
    expect(sources[1]).toContain(cancelled ? "two.png" : "one.png");
    expect(writes).toEqual([]);
  });
}
