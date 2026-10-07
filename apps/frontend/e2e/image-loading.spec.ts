import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const imageUrl = (id: number) => `https://images.example.test/photo-${id}.svg`;
// Raster fixtures expose real intrinsic dimensions consistently in WebKit.
const raster = (width = 640, height = 800) =>
  sharp({ create: { width, height, channels: 3, background: "#e4cfb4" } })
    .png()
    .toBuffer();
const post = (id: number, photos = [imageUrl(id)]) => ({
  id,
  text: `IMAGE_POST_${id}`,
  photos,
  tags: [],
  media: [] as { id: number; type: "video"; url: string; filename: string }[],
  richText: null,
  target: "feed",
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-06T10:00:00Z",
  publishedAt: "2026-10-06T10:00:00Z",
});
async function imagesApi(page: Page, posts = [post(1)]) {
  await editorApi(page, (name) => {
    if (name === "feed.listPaginated" || name === "club.list")
      return ok({
        posts:
          name === "club.list"
            ? posts.map((item) => ({ ...item, target: "club" }))
            : posts,
        nextCursor: null,
      });
    if (name === "club.subscription")
      return ok({
        subscribed: true,
        expiresAt: null,
        cancelAtPeriodEnd: false,
        monthlyPrice: "790",
      });
    if (name === "feed.getById") return ok(posts[0]);
  });
  await page.route("https://s3.twcstorage.ru/**", async (route) =>
    route.fulfill({ contentType: "image/png", body: await raster() }),
  );
  await page.addInitScript(() => {
    const probes: string[] = [];
    Object.defineProperty(window, "__photoProbes", { value: probes });
    const NativeImage = window.Image;
    window.Image = class extends NativeImage {
      set src(uri: string) {
        if (uri.startsWith("https://images.example.test/")) probes.push(uri);
        super.src = uri;
      }
      get src() {
        return super.src;
      }
    };
  });
}

for (const width of [390, 1440]) {
  test(`below-viewport photos wait for scrolling without eager size probes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const requests = new Set<string>();
    await imagesApi(
      page,
      Array.from({ length: 12 }, (_, index) => post(index + 1)),
    );
    await page.route("https://images.example.test/**", async (route) => {
      requests.add(route.request().url());
      return route.fulfill({ contentType: "image/png", body: await raster() });
    });
    await gotoWithSession(page, "/feed");
    const rows = page.locator(".ui-collection-item");
    await expect(rows).toHaveCount(12);
    const photos = page.locator('img[src^="https://images.example.test/"]');
    await expect
      .poll(() =>
        photos
          .first()
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBe(640);
    expect(requests.has(imageUrl(12))).toBe(false);
    expect(requests.size).toBeLessThan(12);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __photoProbes?: string[] })
            .__photoProbes,
      ),
    ).toEqual([]);
    // Offscreen rows retain geometry while their images are unmounted.
    await expect.poll(() => photos.count()).toBeLessThan(12);
    await rows.last().scrollIntoViewIfNeeded();
    const lastPhoto = rows.last().locator(`img[src="${imageUrl(12)}"]`);
    await expect(lastPhoto).toHaveAttribute("loading", "lazy");
    await expect(lastPhoto).toHaveAttribute("decoding", "async");
    await expect
      .poll(() =>
        lastPhoto.evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBe(640);
    expect(requests.has(imageUrl(12))).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`feed-${width}.png`),
    });
  });
}

test("a delayed missing photo keeps its frame and shows a readable fallback", async ({
  page,
}) => {
  await imagesApi(page);
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://images.example.test/**", async (route) => {
    await ready;
    await route.fulfill({ status: 404, body: "Missing" });
  });
  try {
    await gotoWithSession(page, "/post/1");
    const frame = page.getByRole("button", {
      name: "Открыть фото",
      exact: true,
    });
    await expect(frame).toBeVisible();
    const before = await frame.boundingBox();
    expect(before?.height).toBeGreaterThan(300);
    release();
    await expect(
      frame.getByRole("img", { name: "Изображение недоступно" }),
    ).toBeVisible();
    const after = await frame.boundingBox();
    expect(after?.height).toBeCloseTo(before!.height, 1);
    expect(after?.width).toBeCloseTo(before!.width, 1);
    await page.screenshot({
      path: test.info().outputPath("missing-photo.png"),
    });
  } finally {
    release();
  }
});

async function refresh(page: Page) {
  await page
    .locator(
      "main .ui-scroll:not(.ui-scroll-horizontal):has(.ui-collection-item)",
    )
    .evaluate((node) => {
      node.scrollTop = 0;
      const start = new Event("touchstart", { bubbles: true });
      Object.defineProperty(start, "touches", { value: [{ clientY: 0 }] });
      node.dispatchEvent(start);
      const end = new Event("touchend", { bubbles: true });
      Object.defineProperty(end, "changedTouches", {
        value: [{ clientY: 200 }],
      });
      node.dispatchEvent(end);
    });
}

test("replacing a photo keeps its reserved frame and clears a previous failure", async ({
  page,
}) => {
  const posts = [post(1)];
  await imagesApi(page, posts);
  await page.route("https://images.example.test/**", async (route) => {
    const id = route
      .request()
      .url()
      .match(/photo-(\d+)/)?.[1];
    return id === "2"
      ? route.fulfill({ status: 404 })
      : route.fulfill({
          contentType: "image/png",
          body: await raster(
            ...(id === "3" ? ([400, 800] as const) : ([800, 400] as const)),
          ),
        });
  });
  await gotoWithSession(page, "/feed");
  const photo = page.locator('img[src^="https://images.example.test/"]');
  const frame = page.getByRole("button", { name: "Открыть фото", exact: true });
  await expect
    .poll(() =>
      frame.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.getBoundingClientRect().height,
      ),
    )
    .toBeCloseTo(0.8, 2);
  posts[0].photos = [imageUrl(2)];
  await refresh(page);
  await expect(photo).toHaveAttribute("src", imageUrl(2));
  await expect(
    frame.getByRole("img", { name: "Изображение недоступно" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      frame.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.getBoundingClientRect().height,
      ),
    )
    .toBeCloseTo(0.8, 2);
  posts[0].photos = [imageUrl(3)];
  await refresh(page);
  await expect(photo).toHaveAttribute("src", imageUrl(3));
  await expect
    .poll(() =>
      frame.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.getBoundingClientRect().height,
      ),
    )
    .toBeCloseTo(0.8, 2);
  await expect(
    frame.getByRole("img", { name: "Изображение недоступно" }),
  ).toHaveCount(0);
  await expect(photo).toBeVisible();
});

test("recreated cards reserve the same frame before reloading a landscape photo", async ({
  page,
}) => {
  await imagesApi(page);
  let block = false;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://images.example.test/**", async (route) => {
    if (block) await ready;
    await route.fulfill({
      contentType: "image/png",
      body: await raster(800, 400),
    });
  });
  try {
    await gotoWithSession(page, "/feed");
    const frame = page.getByRole("button", {
      name: "Открыть фото",
      exact: true,
    });
    await expect
      .poll(() =>
        frame.evaluate(
          (node) =>
            node.getBoundingClientRect().width /
            node.getBoundingClientRect().height,
        ),
      )
      .toBeCloseTo(0.8, 2);
    block = true;
    await page.getByRole("button", { name: "Показать сеткой" }).click();
    await expect(frame).toHaveCount(0);
    await page.getByRole("button", { name: "Показать лентой" }).click();
    await expect(frame).toBeVisible();
    expect(
      await frame.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.getBoundingClientRect().height,
      ),
    ).toBeCloseTo(0.8, 2);
  } finally {
    release();
  }
});

for (const width of [390, 1440]) {
  test(`the first home banner loads eagerly using economical variants at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await imagesApi(page);
    await gotoWithSession(page, "/");
    const hero = page.locator('img[src*="hero_header"]').first();
    await expect(hero).toHaveAttribute("loading", "eager");
    await expect(hero).toHaveAttribute("fetchpriority", "high");
    await expect(hero).toHaveAttribute("decoding", "async");
    await expect(hero).toHaveAttribute("srcset", /320w/);
    await expect(hero).toHaveAttribute("width", "1400");
    await expect(hero).toHaveAttribute("height", "875");
    await expect
      .poll(() =>
        hero.evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    const source = await hero.evaluate(
      (img) => (img as HTMLImageElement).currentSrc,
    );
    expect(new URL(source).pathname).toMatch(
      /^\/_next\/static\/media\/hero_header\.[a-f0-9]+\.webp$/,
    );
    expect(new URL(source).search).toBe("");
    // Intrinsic dimensions with width descriptors are density-corrected and
    // Chromium may round that correction down by one CSS pixel.
    const intrinsicWidth = await hero.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth,
    );
    expect(Math.abs(intrinsicWidth - Math.min(width, 480))).toBeLessThanOrEqual(
      1,
    );
    const response = await page.request.get(source);
    expect(response.headers()["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    const box = await hero.boundingBox();
    expect(box?.width).toBe(Math.min(width, 480));
    expect(box?.height).toBeGreaterThan(0);
    await page.screenshot({
      path: test.info().outputPath(`home-${width}.png`),
    });
  });
}

for (const width of [390, 1440]) {
  for (const path of ["/feed", "/club", "/post/1"]) {
    for (const count of [1, 4, 10]) {
      test(`reserved gallery frames keep text stable while loading ${count} photos in ${path} at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await imagesApi(page, [
          post(
            1,
            Array.from({ length: count }, (_, index) => imageUrl(index + 1)),
          ),
        ]);
        let release!: () => void;
        const ready = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route("https://images.example.test/**", async (route) => {
          await ready;
          const id = Number(
            route
              .request()
              .url()
              .match(/photo-(\d+)/)?.[1],
          );
          if (id === 4) return route.fulfill({ status: 404 });
          return route.fulfill({
            contentType: "image/png",
            body: await raster(
              ...(id % 2 ? ([1600, 400] as const) : ([400, 1200] as const)),
            ),
          });
        });
        try {
          await gotoWithSession(page, path);
          const photos =
            count === 10
              ? page
                  .getByRole("region", { name: "Фотографии поста" })
                  .locator("img")
              : page.locator('img[src^="https://images.example.test/"]');
          await expect(photos).toHaveCount(count);
          const text = page.getByText("IMAGE_POST_1", { exact: true });
          await expect(text).toHaveCount(1);
          const before = await photos.evaluateAll((nodes) =>
            nodes.map((node) => {
              const { width, height } =
                node.parentElement!.getBoundingClientRect();
              return { width, height };
            }),
          );
          const frame = page.locator("[data-post-photo-frame]");
          const frameBefore = (await frame.boundingBox())!;
          const textBefore = (await text.boundingBox())!;
          expect(frameBefore.height).toBeCloseTo(
            Math.min(frameBefore.width * 1.25, 844 * 0.6),
            1,
          );
          for (const box of before) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
          release();
          await expect
            .poll(() =>
              photos
                .first()
                .evaluate((img) => (img as HTMLImageElement).naturalWidth),
            )
            .toBe(1600);
          await expect(photos.first()).toHaveCSS("opacity", "1");
          const after = await photos.evaluateAll((nodes) =>
            nodes.map((node) => {
              const { width, height } = node.getBoundingClientRect();
              return { width, height, fit: getComputedStyle(node).objectFit };
            }),
          );
          after.forEach((box, index) => {
            expect(box.width).toBeCloseTo(before[index].width, 1);
            expect(box.height).toBeCloseTo(before[index].height, 1);
            expect(box.fit).toBe("cover");
          });
          expect((await frame.boundingBox())!.height).toBeCloseTo(
            frameBefore.height,
            1,
          );
          expect((await text.boundingBox())!.y).toBeCloseTo(textBefore.y, 1);
          if (count === 4) {
            // Both rows fill the same reserved gallery, including failed photos.
            expect(after[0].height).toBeCloseTo(after[1].height, 1);
            expect(after[2].height).toBeCloseTo(after[3].height, 1);
            await expect(
              page.getByRole("img", { name: "Изображение недоступно" }),
            ).toBeVisible();
          }
          if (count === 10) {
            const carousel = page.getByRole("region", {
              name: "Фотографии поста",
            });
            const height = (await carousel.boundingBox())!.height;
            await carousel.locator(".ui-scroll-horizontal").focus();
            await page.keyboard.press("End");
            await expect(
              carousel.getByText("10 / 10", { exact: true }),
            ).toBeVisible();
            await expect
              .poll(() =>
                photos
                  .last()
                  .evaluate((img) => (img as HTMLImageElement).naturalHeight),
              )
              .toBe(1200);
            expect((await carousel.boundingBox())!.height).toBeCloseTo(
              height,
              1,
            );
          }
          if (path === "/post/1" && count === 1) {
            await photos.first().click();
            const viewer = page.getByRole("dialog", {
              name: "Просмотр фотографий",
            });
            await expect(viewer).toBeVisible();
            await expect(viewer.locator(`img[src="${imageUrl(1)}"]`)).toHaveCSS(
              "object-fit",
              "contain",
            );
            await viewer
              .getByRole("button", { name: "Закрыть фотографии" })
              .click();
            await expect(viewer).toHaveCount(0);
          }
          if (width === 390 && path === "/feed")
            await page.screenshot({
              path: test.info().outputPath(`reserved-${count}.png`),
            });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        } finally {
          release();
        }
      });
    }
  }
}

for (const width of [390, 1440]) {
  test(`photos beside a tall video stay inside the reserved gallery and the last photo opens correctly at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const item = post(1, [
      "https://images.example.test/video_thumb.svg",
      ...Array.from({ length: 7 }, (_, index) => imageUrl(index + 1)),
    ]);
    item.media = [
      {
        id: 1,
        type: "video",
        url: "https://images.example.test/video.mp4",
        filename: "video.mp4",
      },
    ];
    await imagesApi(page, [item]);
    await page.route("https://images.example.test/**", async (route) =>
      route.fulfill({
        contentType: "image/png",
        body: await raster(400, 1600),
      }),
    );
    await gotoWithSession(page, "/post/1");
    const photos = page.locator('img[src*="/photo-"]');
    await expect(photos).toHaveCount(7);
    const frame = page.locator("[data-post-photo-frame]");
    const before = (await frame.boundingBox())!;
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          photo.evaluate((node) => (node as HTMLImageElement).naturalHeight),
        )
        .toBe(1600);
      await expect(photo).toHaveCSS("object-fit", "cover");
      const box = (await photo.boundingBox())!;
      expect(box.height).toBeGreaterThan(0);
      expect(box.height).toBeLessThanOrEqual(before.height);
    }
    await page
      .getByRole("button", { name: "Открыть видео", exact: true })
      .click();
    await expect(
      page.locator('video[src="https://images.example.test/video.mp4"]'),
    ).toBeVisible();
    expect((await frame.boundingBox())!.height).toBeCloseTo(before.height, 1);
    await photos.last().scrollIntoViewIfNeeded();
    await photos.last().click();
    const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
    await expect(viewer.getByText("7 / 7", { exact: true })).toBeVisible();
    await expect(viewer.locator(`img[src="${imageUrl(7)}"]`)).toBeInViewport();
  });
}

for (const reducedMotion of [false, true]) {
  test(`photo fades in without resizing its frame; reduced motion: ${reducedMotion}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reducedMotion ? "reduce" : "no-preference",
    });
    await imagesApi(page);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("https://images.example.test/**", async (route) => {
      await ready;
      await route.fulfill({
        contentType: "image/png",
        body: await raster(800, 400),
      });
    });
    try {
      await gotoWithSession(page, "/feed");
      const image = page
        .locator('img[src^="https://images.example.test/"]')
        .first();
      await expect(image).toBeVisible();
      await expect(image).toHaveCSS("opacity", "0");
      const before = (await image.boundingBox())!.height;
      const samples = image.evaluate(async (node) => {
        const values: { height: number; opacity: number }[] = [];
        const end = performance.now() + 600;
        while (performance.now() < end) {
          values.push({
            height: node.getBoundingClientRect().height,
            opacity: Number(getComputedStyle(node).opacity),
          });
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        }
        return values;
      });
      release();
      const frames = await samples;
      await expect(image).toHaveCSS("opacity", "1");
      for (const sample of frames) expect(sample.height).toBeCloseTo(before, 1);
      if (!reducedMotion)
        expect(
          frames.filter((sample) => sample.opacity > 0 && sample.opacity < 1)
            .length,
        ).toBeGreaterThan(2);
      else await expect(image).toHaveCSS("transition-duration", "0s");
      await page.getByRole("button", { name: "Показать сеткой" }).click();
      await page.getByRole("button", { name: "Показать лентой" }).click();
      expect((await image.boundingBox())!.height).toBeCloseTo(before, 1);
    } finally {
      release();
    }
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 844 },
  { width: 390, height: 568 },
]) {
  test(`one to ten photos share one reserved block at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await imagesApi(
      page,
      Array.from({ length: 10 }, (_, index) =>
        post(
          index + 1,
          Array.from({ length: index + 1 }, (_, photo) =>
            imageUrl((index + 1) * 100 + photo),
          ),
        ),
      ),
    );
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("https://images.example.test/**", async (route) => {
      await ready;
      const id = Number(
        route
          .request()
          .url()
          .match(/photo-(\d+)/)?.[1],
      );
      await route.fulfill({
        contentType: "image/png",
        body: await raster(
          ...(id % 2 ? ([1600, 400] as const) : ([400, 1600] as const)),
        ),
      });
    });
    try {
      await gotoWithSession(page, "/feed");
      const rows = page.locator(".ui-collection-item");
      await expect(rows).toHaveCount(10);
      const before: number[] = [];
      for (let index = 0; index < 10; index++) {
        await rows.nth(index).scrollIntoViewIfNeeded();
        const frame = rows.nth(index).locator("[data-post-photo-frame]");
        await expect(frame).toBeVisible();
        before.push((await frame.boundingBox())!.height);
      }
      expect(before[0]).toBeGreaterThan(0);
      expect(before[0]).toBeLessThanOrEqual(viewport.height * 0.6 + 0.5);
      for (const height of before) expect(height).toBeCloseTo(before[0], 1);
      release();
      for (let index = 0; index < 10; index++) {
        await rows.nth(index).scrollIntoViewIfNeeded();
        const frame = rows.nth(index).locator("[data-post-photo-frame]");
        await expect(frame).toBeVisible();
        const first = frame
          .locator('img[src^="https://images.example.test/"]')
          .first();
        await expect
          .poll(() =>
            first.evaluate((node) => (node as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        expect((await frame.boundingBox())!.height).toBeCloseTo(before[0], 1);
        await expect(first).toHaveCSS("object-fit", "cover");
        // Grid cells cover the entire block, allowing only the 1px separators.
        if ((await frame.getAttribute("role")) === "group") {
          const occupied = await frame.locator("img").evaluateAll((nodes) =>
            nodes.reduce((sum, node) => {
              const box = node.getBoundingClientRect();
              return sum + box.width * box.height;
            }, 0),
          );
          const box = (await frame.boundingBox())!;
          expect(occupied / (box.width * box.height)).toBeGreaterThan(0.98);
          expect(occupied / (box.width * box.height)).toBeLessThanOrEqual(
            1.001,
          );
        }
      }
      await page.screenshot({
        path: test
          .info()
          .outputPath(`gallery-${viewport.width}x${viewport.height}.png`),
      });
    } finally {
      release();
    }
  });
}
