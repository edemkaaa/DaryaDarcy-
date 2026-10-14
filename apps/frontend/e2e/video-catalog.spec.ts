import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.skip(
  process.env.VK_CATALOG_UI_ENABLED !== "true",
  "Requires the catalog build; all API/provider replies are synthetic.",
);
const embed = "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
const card = {
  id: 42,
  title: "CATALOG_VIDEO",
  duration: "12:00",
  access: "club",
  canWatch: false,
};
const user = {
  id: 101,
  openId: "catalog-user",
  name: "Тест",
  email: "test@example.test",
  role: "user",
  lastSignedIn: "2026-10-01T12:00:00Z",
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function fixture(page: Page) {
  const state = {
    user: { ...user } as typeof user | null,
    card: { ...card },
    status: 0,
    playback: { id: 42, provider: "vk", embedUrl: embed } as Record<
      string,
      unknown
    >,
    pages: new Map<
      number,
      { items: (typeof card)[]; nextCursor: number | null }
    >(),
    reads: [] as { name: string; input: Record<string, unknown> }[],
    writes: [] as Record<string, unknown>[],
    providers: [] as string[],
    legacy: [] as string[],
    gate: undefined as Promise<void> | undefined,
    saveStatus: 0,
    savedId: 42,
  };
  await editorApi(page, async (name, input) => {
    if (name === "videos.catalog") {
      state.reads.push({ name, input });
      if (input.limit === 1)
        return ok({ items: [state.card], nextCursor: null });
      return ok(
        state.pages.get(Number(input.cursor ?? 0)) ?? {
          items: [state.card],
          nextCursor: null,
        },
      );
    }
    if (name === "videos.playback") {
      state.reads.push({ name, input });
      const response = state.status
        ? failure(state.status)
        : ok({ ...state.playback });
      if (state.gate) await state.gate;
      return response;
    }
    if (name === "videos.list" || name === "videos.getById") {
      state.legacy.push(name);
      return failure(500);
    }
    if (name === "admin.upsertVkVideo") {
      state.writes.push(input);
      return state.saveStatus
        ? failure(state.saveStatus)
        : ok({ id: state.savedId });
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: state.user } }),
  );
  await page.route(
    /https:\/\/(vkvideo\.ru\/video_ext\.php|www\.youtube\.com\/embed\/|media\.example\.test\/)/,
    (route) => {
      state.providers.push(route.request().url());
      return route.fulfill({
        contentType: "text/html",
        body: "<html><body>Synthetic player</body></html>",
      });
    },
  );
  return state;
}

for (const actor of ["guest", "member", "moderator"] as const) {
  test(`authorized public VK is available for ${actor}`, async ({ page }) => {
    const state = await fixture(page);
    if (actor === "guest") state.user = null;
    if (actor === "moderator") state.user!.role = "moderator";
    state.card.access = "public";
    state.card.canWatch = true;
    await gotoWithSession(page, "/video/42");
    await expect(page.getByTitle("VK Видео", { exact: true })).toHaveAttribute(
      "src",
      embed + "&autoplay=0",
    );
    await expect(
      page.getByText("CATALOG_VIDEO", { exact: true }),
    ).toBeVisible();
    expect(state.legacy).toEqual([]);
  });
}
test("catalog does not prefetch any source and paginates without duplicate cards", async ({
  page,
}) => {
  const state = await fixture(page);
  state.pages.set(0, { items: [card], nextCursor: 42 });
  state.pages.set(42, {
    items: [card, { ...card, id: 43, title: "SECOND_VIDEO" }],
    nextCursor: null,
  });
  await gotoWithSession(page, "/videos");
  await expect(
    page.getByRole("button", { name: "Открыть видео: CATALOG_VIDEO" }),
  ).toBeVisible();
  expect(state.reads.filter((row) => row.name === "videos.playback")).toEqual(
    [],
  );
  expect(state.providers).toEqual([]);
  await expect(page.locator("iframe, video")).toHaveCount(0);
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Открыть видео: SECOND_VIDEO" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Открыть видео: CATALOG_VIDEO" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Показать ещё", exact: true }),
  ).toHaveCount(0);
  expect(state.legacy).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("catalog-mobile.png") });
});
test("repeated cursor stops pagination and offers a fresh read", async ({
  page,
}) => {
  const state = await fixture(page);
  state.pages.set(0, { items: [card], nextCursor: 42 });
  state.pages.set(42, { items: [{ ...card, id: 43 }], nextCursor: 42 });
  await gotoWithSession(page, "/videos");
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(
    page.getByText("Не удалось загрузить следующие видео"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Показать ещё", exact: true }),
  ).toHaveCount(0);
  expect(
    state.reads.filter((row) => row.name === "videos.catalog"),
  ).toHaveLength(2);
});
test("canWatch false still asks playback and accepts current authorization", async ({
  page,
}) => {
  await fixture(page);
  await gotoWithSession(page, "/videos");
  await page
    .getByRole("button", { name: "Открыть видео: CATALOG_VIDEO" })
    .click();
  await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
});
for (const [status, message] of [
  [401, "Войдите, чтобы смотреть это видео"],
  [403, "Для просмотра нужен доступ к клубу"],
  [404, "Видео не найдено"],
  [412, "Каталог видео пока недоступен"],
  [500, "Сервис временно недоступен. Попробуйте ещё раз."],
] as const) {
  test(`playback ${status} denies source despite canWatch true`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.status = status;
    state.card.canWatch = true;
    if (status === 401) state.user = null;
    await gotoWithSession(page, "/video/42");
    if (status === 412)
      await expect(
        page.getByRole("button", { name: "Повторить", exact: true }),
      ).toBeVisible();
    else await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.locator("iframe, video")).toHaveCount(0);
    expect(state.providers).toEqual([]);
    expect(state.legacy).toEqual([]);
  });
}
test("a source waits for a successful playback response", async ({ page }) => {
  const state = await fixture(page);
  const gate = deferred();
  state.gate = gate.promise;
  await gotoWithSession(page, "/video/42");
  await expect
    .poll(
      () => state.reads.filter((row) => row.name === "videos.playback").length,
    )
    .toBe(1);
  expect(state.providers).toEqual([]);
  await expect(page.locator("iframe, video")).toHaveCount(0);
  gate.resolve();
  await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
});
test("wrong playback identity never loads a provider", async ({ page }) => {
  const state = await fixture(page);
  state.playback.id = 99;
  await gotoWithSession(page, "/video/42");
  await expect(
    page.getByText("Некорректный ответ сервера. Попробуйте ещё раз."),
  ).toBeVisible();
  expect(state.providers).toEqual([]);
});
test("club YouTube does not use the anonymous public worker", async ({
  page,
}) => {
  const state = await fixture(page);
  state.playback = {
    id: 42,
    provider: "youtube",
    youtubeId: "abc_DEF-123",
    videoUrl: null,
  };
  const worker: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/yt\/|\/media\/yt-thumb\//.test(request.url()))
      worker.push(request.url());
  });
  await gotoWithSession(page, "/video/42");
  await expect(
    page.getByTitle("YouTube Видео", { exact: true }),
  ).toHaveAttribute("src", "https://www.youtube.com/embed/abc_DEF-123");
  expect(worker).toEqual([]);
});
test("public YouTube retains its public video worker", async ({ page }) => {
  const state = await fixture(page);
  state.card.access = "public";
  state.playback = {
    id: 42,
    provider: "youtube",
    youtubeId: "abc_DEF-123",
    videoUrl: null,
  };
  await gotoWithSession(page, "/video/42");
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    /\/api\/yt\/abc_DEF-123$/,
  );
  await expect(page.getByTitle("YouTube Видео", { exact: true })).toHaveCount(
    0,
  );
});
test("authorized file uses a native player and releases its source on pagehide", async ({
  page,
}) => {
  const state = await fixture(page);
  state.playback = {
    id: 42,
    provider: "youtube",
    youtubeId: "abc_DEF-123",
    videoUrl: "https://media.example.test/file.mp4",
  };
  await gotoWithSession(page, "/video/42");
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "https://media.example.test/file.mp4",
  );
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  await expect(page.locator("video[src]")).toHaveCount(0);
});
test("pageshow requires new authority and keeps an old iframe removed", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/video/42");
  await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
  const requests = state.providers.length;
  state.status = 403;
  await page.evaluate(() => {
    dispatchEvent(new Event("pagehide"));
    dispatchEvent(new Event("pageshow"));
  });
  await expect(
    page.getByText("Для просмотра нужен доступ к клубу"),
  ).toBeVisible();
  await expect(page.getByTitle("VK Видео", { exact: true })).toHaveCount(0);
  expect(state.providers).toHaveLength(requests);
});
test("a late source cannot cross an account change", async ({ page }) => {
  const state = await fixture(page);
  const gate = deferred();
  state.gate = gate.promise;
  await gotoWithSession(page, "/video/42");
  await expect
    .poll(
      () => state.reads.filter((row) => row.name === "videos.playback").length,
    )
    .toBe(1);
  state.user = { ...user, id: 202 };
  state.status = 403;
  state.gate = undefined;
  await page.evaluate(() =>
    dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "changed",
      }),
    ),
  );
  await expect(
    page.getByText("Для просмотра нужен доступ к клубу"),
  ).toBeVisible();
  gate.resolve();
  await expect(page.locator("iframe, video")).toHaveCount(0);
  expect(state.providers).toEqual([]);
});
async function openAdmin(page: Page) {
  const state = await fixture(page);
  state.user!.role = "admin";
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Видео", exact: true }).click();
  return state;
}
async function fillAdmin(page: Page, url = embed) {
  await page
    .getByRole("textbox", { name: "Название видео VK" })
    .fill("VK_TITLE");
  await page
    .getByRole("button", { name: "Добавить ссылку VK", exact: true })
    .click();
  await page.getByLabel("Экспортируемая ссылка VK", { exact: true }).fill(url);
  await page
    .getByRole("button", { name: "Добавить видео", exact: true })
    .click();
}
test("admin creates an exact VK payload without an ID or provider preview", async ({
  page,
}) => {
  const state = await openAdmin(page);
  await fillAdmin(page);
  await page.getByRole("button", { name: "Для всех", exact: true }).click();
  await page.getByRole("checkbox", { name: "Опубликовано" }).check();
  await page
    .getByRole("button", { name: "Сохранить видео", exact: true })
    .click();
  await expect(
    page.getByText("Видео сохранено. ID: 42", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([
    {
      embedUrl: embed + "&autoplay=0",
      title: "VK_TITLE",
      access: "public",
      published: true,
    },
  ]);
  expect(state.providers).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("vk-admin-mobile.png"),
  });
});
test("admin edit sends the explicit ID and never converts a rejected YouTube entry", async ({
  page,
}) => {
  const state = await openAdmin(page);
  state.saveStatus = 409;
  await page
    .getByRole("button", { name: "Редактировать по ID", exact: true })
    .click();
  await page.getByRole("textbox", { name: "ID видео VK" }).fill("18");
  await fillAdmin(page);
  await page
    .getByRole("button", { name: "Сохранить видео", exact: true })
    .click();
  await expect(
    page.getByText(
      "Запись с этим ID нельзя сохранить как VK с указанными данными. Проверьте ID и источник ролика.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.writes).toEqual([
    {
      id: 18,
      embedUrl: embed + "&autoplay=0",
      title: "VK_TITLE",
      access: "club",
      published: false,
    },
  ]);
});
test("unknown admin result keeps original fields and retries the same payload", async ({
  page,
}) => {
  const state = await openAdmin(page);
  state.saveStatus = 500;
  await fillAdmin(page);
  await page
    .getByRole("button", { name: "Сохранить видео", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Название видео VK" }),
  ).toBeDisabled();
  state.saveStatus = 0;
  await page
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await expect(
    page.getByText("Видео сохранено. ID: 42", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
test("admin rejects unknown export parameters before POST", async ({
  page,
}) => {
  const state = await openAdmin(page);
  await fillAdmin(page, embed + "&redirect=foreign");
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.providers).toEqual([]);
});

for (const role of ["user", "moderator"]) {
  test(`authorized club playback accepts ${role} without inferring access from role`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.user!.role = role;
    await gotoWithSession(page, "/video/42");
    await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
    expect(state.reads.some((row) => row.name === "videos.playback")).toBe(
      true,
    );
  });
}
