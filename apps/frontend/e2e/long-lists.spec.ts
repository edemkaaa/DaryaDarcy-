import { test, expect, type Page } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { editorApi } from "./editor-fixtures";

test.setTimeout(60_000);
const list = (page: Page) =>
  page.locator(
    "main .ui-scroll:not(.ui-scroll-horizontal):visible:has(.ui-collection-item, .ui-collection-row)",
  );

async function longListApi(
  page: Page,
  path: string,
  count = 48,
  commentDelay: (id: number) => number = () => 0,
  interactiveMedia = false,
) {
  const commentRequests: number[] = [];
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
  await layoutApi(page, true);
  const posts = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    text: `LONG_POST_${index + 1} ${"Текст публикации разной высоты.\n".repeat(4 + (index % 7))}`,
    target: path === "/club" ? "club" : "feed",
    tags: ["Комьюнити"],
    photos:
      interactiveMedia && index === 1
        ? Array.from(
            { length: 10 },
            (_, photo) => `https://images.example.test/carousel-${photo}.svg`,
          )
        : [`https://images.example.test/${index}.svg`],
    media:
      interactiveMedia && index === 2
        ? [
            {
              id: 91,
              type: "audio",
              url: "https://media.example.test/sample.wav",
              filename: "sample.wav",
            },
          ]
        : [],
    richText: null,
    likeCount: 0,
    commentCount: 1,
    createdAt: new Date(Date.UTC(2026, 9, 5) - index * 60_000).toISOString(),
    publishedAt: new Date(Date.UTC(2026, 9, 5) - index * 60_000).toISOString(),
  }));
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="beige"/></svg>',
    }),
  );
  await page.route("https://images.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#e4cfb4"/></svg>',
    }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    const inputs = JSON.parse(
      route.request().postData() ?? url.searchParams.get("input") ?? "{}",
    );
    const results = names.map((name, index) => {
      const input = inputs[index]?.json ?? {};
      let data: unknown = [];
      if (name === "club.subscription")
        data = {
          hasClubAccess: true,
          subscribed: true,
          expiresAt: "2040-11-01T10:00:00Z",
          cancelAtPeriodEnd: false,
          isOwner: false,
          monthlyPrice: "790",
        };
      if (name === "feed.userInteractions")
        data = { likedIds: [], savedIds: [] };
      if (name === "club.list" || name === "feed.listPaginated") {
        const start = input.cursor ?? 0;
        const end = Math.min(start + (input.limit ?? 12), posts.length);
        data = {
          posts: posts.slice(start, end),
          nextCursor: end < posts.length ? end : null,
        };
      }
      if (name === "club.comments") {
        commentRequests.push(input.postId);
        data = [
          {
            id: input.postId * 100,
            postId: input.postId,
            userId: 101,
            parentId: null,
            text: "Комментарий участницы",
            photos: [],
            createdAt: "2026-10-05T10:00:00Z",
            authorName: "Участница",
            authorAvatarUrl: null,
            likeCount: 0,
            likedByMe: false,
          },
        ];
      }
      return { result: { data: { json: data } } };
    });
    const delay = Math.max(
      0,
      ...names.map((name, index) =>
        name === "club.comments"
          ? commentDelay(inputs[index]?.json?.postId)
          : 0,
      ),
    );
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    return route.fulfill({
      json: url.searchParams.get("batch") === "1" ? results : results[0],
    });
  });
  return commentRequests;
}

async function loadAll(page: Page, total = 48) {
  await expect
    .poll(
      async () => {
        await expect(list(page)).toHaveCount(1);
        const count = await list(page).locator(".ui-collection-item").count();
        if (count < total)
          await list(page).evaluate((node) => {
            node.scrollTop = node.scrollHeight;
          });
        return count;
      },
      { timeout: 90_000 },
    )
    .toBe(total);
}

for (const width of [390, 1440]) {
  test(`club retains a reply draft outside the viewport and restores keyboard focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await longListApi(page, "/club");
    await gotoWithSession(page, "/club");
    const first = list(page).locator(".ui-collection-item").first();
    await first.getByRole("button", { name: "Ответить", exact: true }).click();
    const draft = first.getByPlaceholder("Ваш ответ...");
    await draft.fill("Черновик ответа сохраняется при прокрутке");
    await list(page).focus();
    await loadAll(page);
    await list(page).evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(draft).not.toBeInViewport();
    await draft.focus();
    await expect(draft).toBeFocused();
    await expect(draft).toBeInViewport();
    await expect(draft).toHaveValue(
      "Черновик ответа сохраняется при прокрутке",
    );
    await expect(first.getByPlaceholder("Написать комментарий...")).toHaveCount(
      0,
    );
    await page.setViewportSize({
      width: width === 390 ? 480 : 390,
      height: 844,
    });
    await expect(draft).toBeInViewport();
    await expect(draft).toHaveValue(
      "Черновик ответа сохраняется при прокрутке",
    );
    const top = page.getByRole("button", { name: "Наверх", exact: true });
    await list(page).evaluate((node) => {
      node.scrollTop = 360;
    });
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 361;
    });
    await expect(top).toBeVisible();
    await top.click();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    await expect(top).toHaveCount(0);
    await expect(draft).toHaveValue(
      "Черновик ответа сохраняется при прокрутке",
    );
  });

  test(`feed retains expanded text and the top button follows its active list at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await longListApi(page, "/feed");
    await gotoWithSession(page, "/feed");
    const first = list(page).locator(".ui-collection-item").first();
    await first
      .getByRole("button", { name: "Читать дальше →", exact: true })
      .click();
    await expect(
      first.getByRole("button", { name: "свернуть", exact: true }),
    ).toBeVisible();
    await list(page).focus();
    await loadAll(page);
    const top = page.getByRole("button", { name: "Наверх", exact: true });
    await expect(top).toBeVisible();
    await top.click();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    await expect(top).toHaveCount(0);
    await expect(
      first.getByRole("button", { name: "свернуть", exact: true }),
    ).toBeVisible();
    await list(page).evaluate((node) => {
      node.scrollTop = 360;
    });
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 361;
    });
    await expect(top).toBeVisible();
    await page.getByRole("button", { name: "Показать сеткой" }).click();
    await expect(list(page)).toHaveCount(1);
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 700;
    });
    await expect(top).toBeVisible();
    await top.click();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    await expect(top).toHaveCount(0);
    await page.getByRole("button", { name: "Показать лентой" }).click();
    await expect(list(page)).toHaveCount(1);
    await expect(top).toHaveCount(0);
    await list(page).evaluate((node) => {
      node.scrollTop = 700;
    });
    await expect(top).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  });
}

for (const path of ["/feed", "/club"]) {
  test(`measured windows bound heavy DOM and preserve old posts in ${path}`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.setTimeout(120_000);
    const requests = await longListApi(page, path, 360);
    await gotoWithSession(page, path);
    if (path === "/club") {
      await expect(
        list(page).getByPlaceholder("Написать комментарий...").first(),
      ).toBeVisible();
      expect(new Set(requests).size).toBeLessThan(12);
    }
    await loadAll(page, 360);
    await list(page).evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(
      list(page)
        .getByText(/LONG_POST_360 /)
        .last(),
    ).toBeVisible();
    await expect
      .poll(() => list(page).locator('[data-window-mounted="true"]').count())
      .toBeLessThan(20);
    expect(await page.locator("*").count()).toBeLessThan(2_500);
    const before = await list(page).evaluate((node) => ({
      height: node.scrollHeight,
      top: node.scrollTop,
    }));
    await page.waitForTimeout(300);
    const after = await list(page).evaluate((node) => ({
      height: node.scrollHeight,
      top: node.scrollTop,
    }));
    expect(Math.abs(after.height - before.height)).toBeLessThan(2);
    expect(Math.abs(after.top - before.top)).toBeLessThan(2);
    let heapBytes: number | undefined;
    if (browserName === "chromium") {
      const session = await page.context().newCDPSession(page);
      await session.send("HeapProfiler.collectGarbage");
      heapBytes = (await session.send("Runtime.getHeapUsage")).usedSize;
      await session.detach();
    }
    const metrics = {
      path,
      dom: await page.locator("*").count(),
      listDom: await list(page).locator("*").count(),
      mounted: await list(page).locator('[data-window-mounted="true"]').count(),
      comments: requests.length,
      heapBytes,
      ...after,
    };
    console.log(JSON.stringify(metrics));
    await testInfo.attach("list-metrics", {
      body: JSON.stringify(metrics),
      contentType: "application/json",
    });
    await page.screenshot({
      path: `/tmp/daryadarcy-windowed-${path.slice(1)}-${testInfo.project.name}.png`,
    });
    if (path === "/club") expect(new Set(requests).size).toBeLessThan(240);
    // Revisiting a retained tab must not mount or fetch hundreds of old rows.
    const requestCount = requests.length;
    await page.locator('nav a[href="/shop"]').click();
    await page.locator(`nav a[href="${path}"]`).click();
    await expect(
      list(page)
        .getByText(/LONG_POST_360 /)
        .last(),
    ).toBeVisible();
    await expect
      .poll(() =>
        list(page).evaluate(
          (node, top) => Math.abs(node.scrollTop - top),
          after.top,
        ),
      )
      .toBeLessThan(2);
    expect(requests.length - requestCount).toBeLessThan(12);
    await page.setViewportSize({ width: 1440, height: 640 });
    // A shorter viewport may not fit both the beginning and the end of a tall
    // post. Check the reserved ending first, then scroll its text into view.
    await expect
      .poll(async () => {
        await list(page).evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        const card = await list(page)
          .locator(".ui-collection-item")
          .last()
          .boundingBox();
        const arrow = await page
          .getByRole("button", { name: "Наверх", exact: true })
          .boundingBox();
        return card && arrow ? card.y + card.height - arrow.y : Infinity;
      })
      .toBeLessThanOrEqual(-16);
    await list(page)
      .getByText(/LONG_POST_360 /)
      .last()
      .scrollIntoViewIfNeeded();
    await expect(
      list(page)
        .getByText(/LONG_POST_360 /)
        .last(),
    ).toBeInViewport();
    await expect
      .poll(() => list(page).locator('[data-window-mounted="true"]').count())
      .toBeLessThan(20);
    await page.getByRole("button", { name: "Наверх", exact: true }).click();
    await expect
      .poll(() => list(page).evaluate((node) => node.scrollTop))
      .toBe(0);
    await expect(
      list(page)
        .getByText(/LONG_POST_1 /)
        .last(),
    ).toBeVisible();
    await expect(list(page).locator(".ui-collection-item")).toHaveCount(360);
    console.log(
      JSON.stringify({
        path,
        dom: await page.locator("*").count(),
        comments: requests.length,
      }),
    );
  });
}

test("old comment caches expire while a reply draft survives", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-05T12:00:00Z") });
  let reloading = false;
  const requests = await longListApi(page, "/club", 48, (id) =>
    reloading && id === 2 ? 1000 : 0,
  );
  await gotoWithSession(page, "/club");
  const first = list(page).locator(".ui-collection-item").first();
  await first.getByRole("button", { name: "Ответить", exact: true }).click();
  await first.getByPlaceholder("Ваш ответ...").fill("Сохранить этот ответ");
  await expect.poll(() => requests.filter((id) => id === 2).length).toBe(1);
  const second = list(page).locator(".ui-collection-item").nth(1);
  await expect(
    second.getByText("Комментарий участницы", { exact: true }),
  ).toBeVisible();
  const commentHeight = (await second.boundingBox())!.height;
  await list(page).focus();
  await loadAll(page);
  await expect(
    list(page).locator('[data-window-mounted="true"]'),
  ).not.toHaveCount(48);
  await page.clock.fastForward(61_000);
  reloading = true;
  await list(page).evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(first.getByPlaceholder("Ваш ответ...")).toHaveValue(
    "Сохранить этот ответ",
  );
  await expect.poll(() => requests.filter((id) => id === 2).length).toBe(2);
  await expect
    .poll(async () =>
      Math.abs((await second.boundingBox())!.height - commentHeight),
    )
    .toBeLessThan(2);
  await expect(
    second.getByText("Комментарий участницы", { exact: true }),
  ).toBeVisible();
  await first.getByPlaceholder("Ваш ответ...").focus();
  await expect(first.getByPlaceholder("Ваш ответ...")).toBeInViewport();
});

test("a completed native video releases its offscreen row and can be reopened", async ({
  page,
}) => {
  // The native video element can play this short audio-only stream. Its real
  // end drives retention through browser media events.
  const samples = 8000 * 4;
  const wav = Buffer.alloc(44 + samples, 128);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples, 40);
  await page.route("https://media.example.test/**", (route) => {
    // Seeking in WebKit requests the PCM payload after the WAV header.
    // A fixture that ignores Range stalls at readyState=2 after seeking.
    const range = /^bytes=(\d+)-(\d*)$/.exec(
      route.request().headers().range ?? "",
    );
    if (!range)
      return route.fulfill({
        contentType: "audio/wav",
        headers: { "Accept-Ranges": "bytes" },
        body: wav,
      });
    const start = Number(range[1]);
    const end = Math.min(
      range[2] ? Number(range[2]) : wav.length - 1,
      wav.length - 1,
    );
    if (start > end)
      return route.fulfill({
        status: 416,
        headers: { "Content-Range": `bytes */${wav.length}` },
      });
    return route.fulfill({
      status: 206,
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${wav.length}`,
      },
      body: wav.subarray(start, end + 1),
    });
  });
  await editorApi(page, (name) =>
    name === "feed.listPaginated"
      ? {
          result: {
            data: {
              json: {
                posts: Array.from({ length: 12 }, (_, index) => ({
                  id: index + 1,
                  target: "feed",
                  text: `VIDEO_POST_${index + 1}`,
                  tags: [],
                  photos: [],
                  richText: null,
                  likeCount: 0,
                  media: [
                    {
                      id: index + 1,
                      type: "video",
                      url: "https://media.example.test/sample.wav",
                      filename: "sample.wav",
                    },
                  ],
                  createdAt: "2026-10-05T12:00:00Z",
                })),
                nextCursor: null,
              },
            },
          },
        }
      : undefined,
  );
  await gotoWithSession(page, "/feed");
  const row = list(page).locator(".ui-collection-item").first();
  await row.getByRole("button", { name: "Открыть видео", exact: true }).click();
  const video = row.locator("video");
  await video.evaluate(async (node) => {
    const media = node as HTMLVideoElement;
    media.muted = true; // Playback lifecycle does not require an audio output device.
    await media.play();
  });
  await list(page).focus();
  await list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(video).toHaveCount(1);
  await expect(row).toHaveAttribute("data-window-mounted", "true");
  // Chromium may pause an offscreen video itself. Finish it in view before
  // checking that the now-completed player no longer pins the distant row.
  await row.scrollIntoViewIfNeeded();
  await video.evaluate(async (node) => {
    const media = node as HTMLVideoElement;
    media.currentTime = 0;
    await media.play();
  });
  await expect
    .poll(
      () =>
        video.evaluate((node) => {
          const media = node as HTMLVideoElement;
          return {
            ended: media.ended,
            paused: media.paused,
            time: media.currentTime,
            duration: media.duration,
          };
        }),
      {
        timeout: 10_000,
      },
    )
    .toMatchObject({ ended: true })
    .catch(async (error) => {
      console.log(
        "video completion diagnostic",
        await video.evaluate((node) => {
          const media = node as HTMLVideoElement;
          const bounds = media.getBoundingClientRect();
          return {
            ended: media.ended,
            paused: media.paused,
            time: media.currentTime,
            duration: media.duration,
            ready: media.readyState,
            hidden: document.hidden,
            y: bounds.y,
            height: bounds.height,
            viewport: innerHeight,
          };
        }),
      );
      throw error;
    });
  await list(page).focus();
  await list(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(row).toHaveAttribute("data-window-mounted", "false");
  await expect(video).toHaveCount(0);
  await row.scrollIntoViewIfNeeded();
  await expect(
    row.getByRole("button", { name: "Открыть видео", exact: true }),
  ).toBeVisible();
});

test("feed stops a repeated cursor, deduplicates posts and retries explicitly", async ({
  page,
}) => {
  await longListApi(page, "/feed");
  let fixed = false;
  const cursors: number[] = [];
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    if (!names.includes("feed.listPaginated")) return route.fallback();
    const inputs = JSON.parse(url.searchParams.get("input") ?? "{}");
    const results = names.map((name, index) => {
      let data: unknown = [];
      if (name === "feed.userInteractions")
        data = { likedIds: [], savedIds: [] };
      if (name === "club.subscription")
        data = {
          hasClubAccess: true,
          subscribed: true,
          expiresAt: "2040-11-01T10:00:00Z",
          cancelAtPeriodEnd: false,
          isOwner: false,
          monthlyPrice: "790",
        };
      if (name === "feed.listPaginated") {
        const cursor = inputs[index]?.json?.cursor ?? 0;
        if (cursor) cursors.push(cursor);
        data = {
          posts: [
            {
              id: fixed ? 3 : 1,
              text: fixed ? "RETRY_OK" : "REPEATED_POST",
              target: "feed",
              tags: [],
              photos: [],
              media: [],
              likeCount: 0,
              createdAt: "2026-10-05T12:00:00Z",
            },
          ],
          nextCursor: fixed ? null : 12,
        };
        if (cursor > 12) throw new Error("Repeated cursor was requested again");
      }
      return { result: { data: { json: data } } };
    });
    await route.fulfill({
      json: url.searchParams.get("batch") === "1" ? results : results[0],
    });
  });
  await gotoWithSession(page, "/feed");
  await expect(
    page.getByText("Не удалось загрузить следующие публикации ленты"),
  ).toBeVisible();
  await expect(list(page).locator(".ui-collection-item")).toHaveCount(1);
  // Session confirmation may cancel and restart the initial public read.
  // The repeated pagination cursor must still be requested only once.
  expect(cursors).toEqual([12]);
  await expect(page.getByText("Все посты загружены")).toHaveCount(0);
  fixed = true;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByText("RETRY_OK", { exact: true })).toBeVisible();
  // A successful full refresh ends at the new first page, without the stale cursor.
  expect(cursors).toEqual([12]);
  await expect(
    page.getByText("Не удалось загрузить следующие публикации ленты"),
  ).toHaveCount(0);
});

test("windowing preserves the chosen photo and audio playback", async ({
  page,
}) => {
  // Silent PCM WAV generated in memory; no test assets enter the app's public folder.
  const samples = 8000 * 60;
  const wav = Buffer.alloc(44 + samples, 128);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples, 40);
  await page.route("https://media.example.test/**", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav }),
  );
  await longListApi(page, "/feed", 48, () => 0, true);
  await gotoWithSession(page, "/feed");
  const photoRow = list(page).locator(".ui-collection-item").nth(1);
  const carousel = photoRow.getByLabel("Перелистывание фотографий", {
    exact: true,
  });
  await carousel.focus();
  await carousel.press("End");
  await expect(photoRow.getByText("10 / 10", { exact: true })).toBeVisible();
  const audioRow = list(page).locator(".ui-collection-item").nth(2);
  await audioRow
    .getByRole("button", { name: "Воспроизвести аудио", exact: true })
    .click();
  await expect(
    audioRow.getByRole("button", { name: "Приостановить аудио", exact: true }),
  ).toBeVisible();
  await list(page).focus();
  await loadAll(page);
  await expect(photoRow).toHaveAttribute("data-window-mounted", "true");
  await expect(audioRow).toHaveAttribute("data-window-mounted", "true");
  await expect(
    audioRow.getByRole("button", { name: "Приостановить аудио", exact: true }),
  ).not.toBeInViewport();
  await list(page)
    .locator(".ui-collection-item")
    .last()
    .scrollIntoViewIfNeeded();
  await photoRow.scrollIntoViewIfNeeded();
  await expect(photoRow.getByText("10 / 10", { exact: true })).toBeVisible();
  await photoRow
    .getByRole("button", { name: "Открыть фото 10 из 10", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("10 / 10", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await audioRow
    .getByRole("button", { name: "Приостановить аудио", exact: true })
    .click();
  await expect(
    audioRow.getByRole("button", { name: "Воспроизвести аудио", exact: true }),
  ).toBeVisible();
});
