import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const listSelector = '[data-tab-screen="/club"] [data-windowed-collection]';
const imageUrl = (id: number) => `https://club-preload.test/${id}.svg`;
const post = (id: number) => ({
  id,
  text: `Публикация ${id}.\nПроверка ранней загрузки фотографий клуба.`,
  photos: [imageUrl(id)],
  tags: ["life"],
  media: [],
  richText: null,
  source: "manual",
  target: "club",
  published: true,
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date(Date.UTC(2026, 9, 25 - id)).toISOString(),
  publishedAt: new Date(Date.UTC(2026, 9, 25 - id)).toISOString(),
});

async function setup(page: Page) {
  const state = { pages: 0, remainingAtNextRequest: 0 };
  let releasePhoto = () => {};
  const delayedPhoto = new Promise<void>((resolve) => {
    releasePhoto = resolve;
  });
  await layoutApi(page, true, (name, input) => {
    if (name !== "club.list") return undefined;
    const cursor = Number(input.cursor ?? 0);
    state.pages++;
    if (cursor > 0) {
      void page
        .locator(listSelector)
        .evaluate(
          (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
        )
        .then((remaining) => {
          state.remainingAtNextRequest = remaining;
        });
    }
    const data = {
      posts: Array.from({ length: 12 }, (_, index) => post(cursor + index + 1)),
      nextCursor: cursor === 0 ? 12 : null,
    };
    return { result: { data: { json: data } } };
  });
  await page.route("https://club-preload.test/**", async (route) => {
    const id = Number(new URL(route.request().url()).pathname.slice(1, -4));
    if (id === 13) await delayedPhoto;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${id === 13 ? 1200 : 400}"><rect width="100%" height="100%" fill="#c7b394"/></svg>`,
    });
  });
  await gotoWithSession(page, "/club");
  return { state, releasePhoto };
}

for (const width of [390, 1440]) {
  test(`club loads the next page and its photos before they enter view (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const { state, releasePhoto } = await setup(page);
    const list = page.locator(listSelector);
    await expect(list).toBeVisible();
    const first = list.locator(`img[src="${imageUrl(1)}"]`);
    await first.evaluate((image) => (image as HTMLImageElement).decode());
    expect(state.pages).toBe(1);

    // An offscreen mounted row opts into eager loading in the two-screen window.
    const nearbyPhoto = list.locator(`img[src="${imageUrl(5)}"]`);
    await expect(nearbyPhoto).toHaveAttribute("loading", "eager");
    expect((await nearbyPhoto.boundingBox())!.y).toBeGreaterThan(
      (await list.boundingBox())!.height,
    );

    const nextPhotoRequested = page.waitForRequest(imageUrl(13));
    await list.evaluate((node) => {
      node.scrollTop = node.scrollHeight - node.clientHeight * 2.25;
    });
    await expect.poll(() => state.pages).toBe(2);
    await expect
      .poll(() => state.remainingAtNextRequest)
      .toBeGreaterThan((await list.boundingBox())!.height * 0.5);
    await nextPhotoRequested;
    const nextPhoto = list.locator(`img[src="${imageUrl(13)}"]`);
    await expect(nextPhoto).toHaveAttribute("loading", "eager");
    const viewport = (await list.boundingBox())!;
    expect((await nextPhoto.boundingBox())!.y).toBeGreaterThan(
      viewport.y + viewport.height,
    );
    releasePhoto();
    await nextPhoto.evaluate((image) => (image as HTMLImageElement).decode());
    await expect
      .poll(async () => {
        const box = (await nextPhoto.boundingBox())!;
        return box.width / box.height;
      })
      .toBeCloseTo(2 / 3, 1);
    const height = (await nextPhoto.boundingBox())!.height;
    await nextPhoto.scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect((await nextPhoto.boundingBox())!.height).toBeCloseTo(height, 0);
    expect(state.pages).toBe(2);
  });
}
