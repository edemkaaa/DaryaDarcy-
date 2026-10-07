import { test, expect, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const imageUrl = (id: number) => `https://images.example.test/photo-${id}.svg`;
const svg = (width = 640, height = 800) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#e4cfb4"/></svg>`;
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
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg() }),
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
    await page.route("https://images.example.test/**", (route) => {
      requests.add(route.request().url());
      return route.fulfill({ contentType: "image/svg+xml", body: svg() });
    });
    await gotoWithSession(page, "/feed");
    const photos = page.locator('img[src^="https://images.example.test/"]');
    await expect(photos).toHaveCount(12);
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
    await expect(photos.last()).toHaveAttribute("loading", "lazy");
    await expect(photos.last()).toHaveAttribute("decoding", "async");
    await photos.last().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        photos.last().evaluate((img) => (img as HTMLImageElement).naturalWidth),
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
      node.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          touches: [new Touch({ identifier: 1, target: node, clientY: 0 })],
        }),
      );
      node.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          changedTouches: [
            new Touch({ identifier: 1, target: node, clientY: 200 }),
          ],
        }),
      );
    });
}

test("replacing a photo preserves its fixed frame and clears a previous failure", async ({
  page,
}) => {
  const posts = [post(1)];
  await imagesApi(page, posts);
  await page.route("https://images.example.test/**", (route) => {
    const id = route
      .request()
      .url()
      .match(/photo-(\d+)/)?.[1];
    return id === "2"
      ? route.fulfill({ status: 404 })
      : route.fulfill({
          contentType: "image/svg+xml",
          body: id === "3" ? svg(400, 800) : svg(800, 400),
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

test("recreated cards reserve their fixed frame before reloading a landscape photo", async ({
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
    await route.fulfill({ contentType: "image/svg+xml", body: svg(800, 400) });
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
      /^\/_next\/static\/media\/hero_header\.[a-f0-9]+\.jpg$/,
    );
    expect(new URL(source).search).toBe("");
    // Intrinsic dimensions with width descriptors are density-corrected and
    // Chromium may round that correction down by one CSS pixel.
    const intrinsicWidth = await hero.evaluate((img) => (img as HTMLImageElement).naturalWidth);
    expect(Math.abs(intrinsicWidth - Math.min(width, 480))).toBeLessThanOrEqual(1);
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
      test(`fixed photo frames keep publication text stable before and after loading ${count} photos in ${path} at ${width}px`, async ({
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
            contentType: "image/svg+xml",
            body: id % 2 ? svg(1600, 400) : svg(400, 1200),
          });
        });
        try {
          await gotoWithSession(page, path);
          const photos = count === 10
            ? page.getByRole("region", { name: "Фотографии поста" }).locator("img")
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
          const textBefore = await text.boundingBox();
          for (const box of before) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.width / box.height).toBeCloseTo(0.8, 2);
          }
          release();
          await expect
            .poll(() =>
              photos
                .first()
                .evaluate((img) => (img as HTMLImageElement).naturalWidth),
            )
            .toBe(1600);
          const after = await photos.evaluateAll((nodes) =>
            nodes.map((node) => {
              const { width, height } =
                node.parentElement!.getBoundingClientRect();
              return { width, height, fit: getComputedStyle(node).objectFit };
            }),
          );
          after.forEach((box, index) => {
            expect(box.width).toBeCloseTo(before[index].width, 1);
            expect(box.height).toBeCloseTo(before[index].height, 1);
            expect(box.fit).toBe("contain");
          });
          expect((await text.boundingBox())!.y).toBeCloseTo(textBefore!.y, 1);
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
              path: test.info().outputPath(`fixed-${count}.png`),
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
  test(`photos beside a tall video retain their frames and the last photo opens correctly at ${width}px`, async ({
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
    await page.route("https://images.example.test/**", (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: svg(400, 1600) }),
    );
    await gotoWithSession(page, "/post/1");
    const photos = page.locator('img[src*="/photo-"]');
    await expect(photos).toHaveCount(7);
    await expect
      .poll(() =>
        page
          .locator('img[src*="video_thumb"]')
          .evaluate((img) => (img as HTMLImageElement).naturalHeight),
      )
      .toBe(1600);
    for (const box of await photos.evaluateAll((nodes) =>
      nodes.map((node) => {
        const { width, height } = node.parentElement!.getBoundingClientRect();
        return { width, height };
      }),
    ))
      expect(box.width / box.height).toBeCloseTo(0.8, 2);
    await photos.last().scrollIntoViewIfNeeded();
    await photos.last().click();
    const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
    await expect(viewer.getByText("7 / 7", { exact: true })).toBeVisible();
    await expect(viewer.locator(`img[src="${imageUrl(7)}"]`)).toBeInViewport();
  });
}
