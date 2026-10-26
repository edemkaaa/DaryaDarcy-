import { test, expect } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const embed =
  "https://vkvideo.ru/video_ext.php?oid=-227034863&id=456239527&hash=99fae216cf20dcdc";
const videoUrl = "https://media.example.test/broken.mp4";

for (const path of ["/feed", "/post/42", "/video/42"]) {
  test(`broken video has an explicit retry and releases its source on ${path}`, async ({
    page,
  }) => {
    let requests = 0;
    const post = {
      id: 42,
      text: "MEDIA_TEST",
      photos: [],
      tags: ["video"],
      target: "feed",
      status: "published",
      published: true,
      createdAt: "2026-10-13T10:00:00Z",
      media: [{ id: 1, type: "video", url: videoUrl }],
    };
    await editorApi(page, (name) => {
      if (name === "feed.getById") return ok(post);
      if (name === "feed.listPaginated")
        return ok({ posts: [post], nextCursor: null });
      if (name === "videos.getById")
        return ok({ id: 42, title: "MEDIA_TEST", videoUrl, youtubeId: "" });
    });
    await page.route(videoUrl, (route) => {
      requests++;
      return route.fulfill({
        status: 200,
        contentType: "video/mp4",
        body: "corrupted video bytes",
      });
    });
    await gotoWithSession(page, path);
    if (path !== "/video/42")
      await page
        .getByRole("button", { name: "Открыть видео", exact: true })
        .click();
    const video = page.locator("video");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Не удалось воспроизвести видео" }),
    ).toBeVisible();
    const before = requests;
    await page
      .getByRole("button", { name: "Повторить загрузку видео", exact: true })
      .click();
    await expect.poll(() => requests).toBeGreaterThan(before);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Не удалось воспроизвести видео" }),
    ).toBeVisible();
    const handle = await video.elementHandle();
    if (path === "/feed")
      await page
        .getByRole("button", { name: "Показать сеткой", exact: true })
        .click();
    else
      await page
        .getByRole("button", {
          name: "Вернуться назад",
          exact: true,
        })
        .click();
    await expect
      .poll(() => handle!.evaluate((node) => node.getAttribute("src")))
      .toBe(null);
    expect(
      await handle!.evaluate((node) => (node as HTMLVideoElement).paused),
    ).toBe(true);
    await handle!.dispose();
  });
}

test("VK unloads in a hidden retained tab and never autoplays on return", async ({
  page,
}) => {
  let requests = 0;
  await editorApi(page, (name) =>
    name === "feed.listPaginated"
      ? ok({
          posts: [
            {
              id: 42,
              text: "VK_LIFECYCLE",
              photos: [],
              tags: [],
              target: "feed",
              createdAt: "2026-10-13T10:00:00Z",
              media: [{ id: 1, type: "video", url: embed }],
            },
          ],
          nextCursor: null,
        })
      : undefined,
  );
  await page.route("https://vkvideo.ru/**", (route) => {
    requests++;
    return route.fulfill({
      contentType: "text/html",
      body: "<html><body>VK fixture</body></html>",
    });
  });
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Открыть видео", exact: true })
    .click();
  const player = page.getByTitle("VK Видео", { exact: true });
  await expect(player).toBeVisible();
  await expect.poll(() => requests).toBe(1);
  await expect(
    page.getByRole("button", { name: "Перезагрузить плеер VK", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Видео", exact: true })
    .click();
  await expect(player).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Лента", exact: true })
    .click();
  // Windowing may evict the hidden card; reopening is an explicit user action.
  const preview = page.getByRole("button", {
    name: "Открыть видео",
    exact: true,
  });
  // Route restoration is asynchronous; do not choose a branch while both
  // the retained player and a recreated preview are temporarily absent.
  await expect
    .poll(async () => (await player.isVisible()) || (await preview.isVisible()))
    .toBe(true);
  if (!(await player.count())) await preview.click();
  await expect(player).toHaveAttribute("src", embed + "&autoplay=0");
  // Visibility event emulation covers lifecycle logic, not an actual OS background transition.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(player).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(player).toHaveAttribute("src", embed + "&autoplay=0");
});

test("a denied club post response never requests a VK player", async ({
  page,
}) => {
  let requests = 0;
  await editorApi(page, (name) =>
    name === "feed.getById" ? ok(null) : undefined,
  );
  await page.route("https://vkvideo.ru/**", (route) => {
    requests++;
    return route.abort();
  });
  await gotoWithSession(page, "/post/42");
  await expect(page.getByText("Пост не найден", { exact: true })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(requests).toBe(0);
});

for (const format of ["jpg", "png", "webp", "heic"]) {
  test(`corrupt ${format} refuses upload and releases every temporary URL over repeated attempts`, async ({
    page,
  }) => {
    const messages: string[] = [];
    let uploads = 0;
    await page.addInitScript(() => {
      const active = new Set<string>();
      const create = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = create(blob);
        active.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        active.delete(url);
        revoke(url);
      };
      Object.defineProperty(window, "pendingMediaUrls", {
        get: () => active.size,
      });
    });
    page.on("dialog", async (dialog) => {
      if (dialog.type() !== "confirm") messages.push(dialog.message());
      await dialog.accept();
    });
    await editorApi(page, (name) => {
      if (
        name === "admin.uploadPhoto" ||
        name === "admin.uploadPrivateContentFile"
      )
        uploads++;
    });
    await gotoWithSession(page, "/feed");
    await page.getByRole("button", { name: "Новый пост", exact: true }).click();
    for (let cycle = 0; cycle < 3; cycle++) {
      const form = page.getByRole("dialog", {
        name: "Редактор публикации",
        exact: true,
      });
      await expect(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible();
      const chooser = page.waitForEvent("filechooser");
      await form
        .getByRole("button", { name: "Выбрать из галереи", exact: true })
        .click();
      await (
        await chooser
      ).setFiles({
        name: `broken.${format}`,
        mimeType: `image/${format === "jpg" ? "jpeg" : format}`,
        buffer: Buffer.from("not a decodable image"),
      });
      await expect.poll(() => messages.length).toBe(cycle + 1);
      expect(messages.at(-1)).toMatch(/фото|HEIC|формат/i);
      await expect
        .poll(() =>
          page.evaluate(() => Reflect.get(window, "pendingMediaUrls")),
        )
        .toBe(0);
      // A rejected selection remains visible until the user explicitly removes it.
      const remove = form.getByRole("button", {
        name: "Отказаться от выбранных файлов",
        exact: true,
      });
      if (await remove.count()) await remove.first().click();
    }
    expect(uploads).toBe(0);
  });
}

test("a failed access refetch hides a previously loaded video instead of retaining stale playback", async ({
  page,
}) => {
  let deny = false;
  const video = {
    id: 42,
    title: "PRIVATE_VIDEO",
    videoUrl: embed,
    youtubeId: "",
  };
  await editorApi(page, (name) => {
    if (name === "videos.list") return ok([video]);
    if (name !== "videos.getById") return;
    return deny
      ? {
          error: {
            json: {
              message: "Нет доступа",
              code: -32003,
              data: { code: "FORBIDDEN", httpStatus: 403 },
            },
          },
        }
      : ok(video);
  });
  await page.route("https://vkvideo.ru/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html>Player fixture</html>",
    }),
  );
  await gotoWithSession(page, "/videos");
  await page.getByText("PRIVATE_VIDEO", { exact: true }).click();
  await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
  deny = true;
  await page.clock.setFixedTime(new Date(Date.now() + 60_000));
  await page
    .getByRole("button", { name: "Вернуться назад", exact: true })
    .click();
  await page
    .getByText("PRIVATE_VIDEO", { exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByTitle("VK Видео", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
});

test("loaded VK keeps recovery controls away from the provider's interactive frame", async ({
  page,
}) => {
  await editorApi(page, (name) => {
    if (name === "videos.getById")
      return ok({
        id: 42,
        title: "VK_CONTROLS",
        videoUrl: embed,
        youtubeId: "",
      });
    if (name === "videos.catalog")
      return ok({
        items: [
          { id: 42, title: "VK_CONTROLS", access: "public", canWatch: true },
        ],
        nextCursor: null,
      });
    if (name === "videos.playback")
      return ok({ id: 42, provider: "vk", embedUrl: embed });
  });
  await page.route("https://vkvideo.ru/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>VK controls fixture</p>",
    }),
  );
  await gotoWithSession(page, "/video/42");
  const frame = page.getByTitle("VK Видео", { exact: true });
  const reload = page.getByRole("button", {
    name: "Перезагрузить плеер VK",
    exact: true,
  });
  await expect(frame).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="VK Видео"]')
      .getByText("VK controls fixture"),
  ).toBeVisible();
  await expect(reload).toHaveCount(0);
});
