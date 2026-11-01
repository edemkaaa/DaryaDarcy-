import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

test.skip(
  process.env.VK_CATALOG_UI_ENABLED !== "true",
  "Requires the catalog build; all API/provider replies are synthetic.",
);
const embed = "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
const thumbnailsEnabled = process.env.VIDEO_THUMBNAILS_UI_ENABLED === "true";
const thumbnailOptIn = thumbnailsEnabled ? { includeThumbnails: true } : {};
const card: {
  id: number;
  title: string;
  duration: string | null;
  access: "public" | "club";
  canWatch: boolean;
  thumbnailUrl?: string | null;
} = {
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
    catalogGate: undefined as Promise<void> | undefined,
    catalogFailures: new Map<number, number>(),
    pageErrors: [] as string[],
    saveStatus: 0,
    detailStatus: 0,
    dropSaveResponse: false,
    savedId: 42,
  };
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
  await editorApi(page, async (name, input, route) => {
    if (name === "videos.catalog") {
      state.reads.push({ name, input });
      const catalogSnapshot = structuredClone(
        input.limit === 1
          ? { items: [state.card], nextCursor: null }
          : (state.pages.get(Number(input.cursor ?? 0)) ?? {
              items: [state.card],
              nextCursor: null,
            }),
      );
      if (state.catalogGate) await state.catalogGate;
      const catalogStatus = state.catalogFailures.get(
        Number(input.cursor ?? 0),
      );
      if (catalogStatus) return failure(catalogStatus);
      // Model the documented opt-in separately from the currently deployed contract.
      const allowed = [
        "limit",
        "cursor",
        ...(thumbnailsEnabled ? ["includeThumbnails"] : []),
      ];
      if (Object.keys(input).some((key) => !allowed.includes(key)))
        return failure(400);
      if (
        input.limit !== 1 &&
        thumbnailsEnabled &&
        input.includeThumbnails !== true
      )
        return failure(400);
      return ok(catalogSnapshot);
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
    if (name === "admin.vkVideoDetail") {
      state.reads.push({ name, input });
      return state.detailStatus
        ? failure(state.detailStatus)
        : ok({
            id: input.id,
            title: "SERVER_TITLE",
            embedUrl: embed,
            access: "club",
            published: false,
            thumbnailUrl: null,
            editRevision: 0,
          });
    }
    if (name === "admin.upsertVkVideo") {
      state.writes.push(input);
      if (state.dropSaveResponse) {
        await route.abort("failed");
        return ok({ id: state.savedId });
      }
      return state.saveStatus
        ? failure(state.saveStatus)
        : ok({ id: input.id ?? state.savedId });
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

const authorityReads = (state: Awaited<ReturnType<typeof fixture>>) => ({
  playback: state.reads.filter((row) => row.name === "videos.playback").length,
  metadata: state.reads.filter(
    (row) => row.name === "videos.catalog" && row.input.limit === 1,
  ).length,
});
async function dispatchResume(page: Page, event: string) {
  await page.evaluate((event) => {
    (event === "visibilitychange" ? document : window).dispatchEvent(
      new Event(event),
    );
  }, event);
  await page.clock.runFor(100);
}
async function prepareReturnClock(page: Page) {
  await page.clock.install({ time: new Date("2026-10-26T12:00:00Z") });
  await page.clock.fastForward(1100);
}

for (const provider of ["vk", "youtube"] as const) {
  test(`player focus: ${provider} keeps playback when clicking the page outside the iframe`, async ({
    page,
  }) => {
    const state = await fixture(page);
    if (provider === "youtube")
      state.playback = {
        id: 42,
        provider: "youtube",
        youtubeId: "dQw4w9WgXcQ",
        videoUrl: null,
      };
    await page.route(
      /https:\/\/(vkvideo\.ru\/video_ext\.php|www\.youtube\.com\/embed\/)/,
      (route) => {
        state.providers.push(route.request().url());
        return route.fulfill({
          contentType: "text/html",
          body: `<button onclick="this.textContent='Playing'; document.body.dataset.playing='true'">Play</button>`,
        });
      },
    );
    await gotoWithSession(page, "/video/42");
    const frame = page.locator("iframe");
    await expect(frame).toBeVisible();
    await prepareReturnClock(page);
    const before = authorityReads(state);
    const requests = state.providers.length;
    const button = frame.contentFrame().getByRole("button");
    await button.click();
    await expect(button).toHaveText("Playing");
    // Real clicks move focus between a cross-origin iframe and the page.
    // On desktop these coordinates lie in the left and right page margins.
    for (const x of [2, page.viewportSize()!.width - 2, 2]) {
      await button.click();
      await page.clock.runFor(1100);
      await page.mouse.click(x, 450);
      await page.clock.runFor(200);
      await expect(frame.contentFrame().locator("body")).toHaveAttribute(
        "data-playing",
        "true",
      );
      expect(authorityReads(state)).toEqual(before);
      expect(state.providers).toHaveLength(requests);
    }
    await button.click();
    await page.keyboard.press("Tab");
    await page.clock.runFor(200);
    await expect(frame.contentFrame().locator("body")).toHaveAttribute(
      "data-playing",
      "true",
    );
    expect(authorityReads(state)).toEqual(before);
    expect(state.providers).toHaveLength(requests);
    // Focusing the player must not suppress subsequent mandatory checks.
    await button.click();
    state.status = 403;
    await dispatchResume(page, "pagehide");
    await dispatchResume(page, "pageshow");
    await expect(
      page.getByText("Для просмотра нужен доступ к клубу", { exact: true }),
    ).toBeVisible();
    await expect(frame).toHaveCount(0);
  });
}

for (const first of ["focus", "visibilitychange"]) {
  test(`playback return: ${first} and its paired event share one successful authority and metadata read`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await gotoWithSession(page, "/video/42");
    const frame = page.getByTitle("VK Видео", { exact: true });
    await expect(frame).toBeVisible();
    await prepareReturnClock(page);
    const before = authorityReads(state);
    await dispatchResume(page, first);
    await expect
      .poll(() => authorityReads(state))
      .toEqual({
        playback: before.playback + 1,
        metadata: before.metadata + 1,
      });
    // The first request has completed before the paired event is delivered.
    await expect(frame).toBeVisible();
    await dispatchResume(
      page,
      first === "focus" ? "visibilitychange" : "focus",
    );
    expect(authorityReads(state)).toEqual({
      playback: before.playback + 1,
      metadata: before.metadata + 1,
    });
    // Another later return must still recheck both reads.
    await page.clock.runFor(1100);
    await dispatchResume(page, "focus");
    await expect
      .poll(() => authorityReads(state))
      .toEqual({
        playback: before.playback + 2,
        metadata: before.metadata + 2,
      });
    await expect(frame).toBeVisible();
  });
}

for (const event of ["online", "pageshow"]) {
  test(`playback return: ${event} bypasses coalescing and a fresh denial removes the source`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await gotoWithSession(page, "/video/42");
    const frame = page.getByTitle("VK Видео", { exact: true });
    await expect(frame).toBeVisible();
    await prepareReturnClock(page);
    await dispatchResume(page, "focus");
    await expect(frame).toBeVisible();
    const before = authorityReads(state);
    state.status = 403;
    await dispatchResume(page, event);
    await expect(
      page.getByText("Для просмотра нужен доступ к клубу", { exact: true }),
    ).toBeVisible();
    await expect(frame).toHaveCount(0);
    expect(authorityReads(state)).toEqual({
      playback: before.playback + 1,
      metadata: before.metadata + 1,
    });
  });
}

test("playback return: quick hide and window blur require fresh authority within the same second", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/video/42");
  const frame = page.getByTitle("VK Видео", { exact: true });
  await expect(frame).toBeVisible();
  await prepareReturnClock(page);
  await dispatchResume(page, "focus");
  await expect(frame).toBeVisible();
  const before = authorityReads(state);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(frame).toHaveCount(0);
  await dispatchResume(page, "online");
  expect(authorityReads(state)).toEqual(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });
  await dispatchResume(page, "visibilitychange");
  await expect(frame).toBeVisible();
  await dispatchResume(page, "focus");
  expect(authorityReads(state)).toEqual({
    playback: before.playback + 1,
    metadata: before.metadata + 1,
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: () => false,
    });
    window.dispatchEvent(new Event("blur"));
    delete (document as unknown as { hasFocus?: () => boolean }).hasFocus;
  });
  await dispatchResume(page, "focus");
  await expect(frame).toBeVisible();
  expect(authorityReads(state)).toEqual({
    playback: before.playback + 2,
    metadata: before.metadata + 2,
  });
});

test("playback return: a late previous check cannot restore a source after a newer denial", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  try {
    await gotoWithSession(page, "/video/42");
    const frame = page.getByTitle("VK Видео", { exact: true });
    await expect(frame).toBeVisible();
    await prepareReturnClock(page);
    const before = authorityReads(state);
    state.gate = gate.promise;
    await dispatchResume(page, "focus");
    await expect
      .poll(() => authorityReads(state).playback)
      .toBe(before.playback + 1);
    await expect(frame).toHaveCount(0);
    state.gate = undefined;
    state.status = 403;
    await dispatchResume(page, "pagehide");
    await dispatchResume(page, "pageshow");
    await expect(
      page.getByText("Для просмотра нужен доступ к клубу", { exact: true }),
    ).toBeVisible();
    gate.resolve();
    await page.clock.runFor(100);
    await expect(frame).toHaveCount(0);
    expect(authorityReads(state).playback).toBe(before.playback + 2);
  } finally {
    gate.resolve();
  }
});

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
for (const width of [390, 1440]) {
  test(`catalog background refresh leaves cards still while pending (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    const state = await fixture(page);
    await gotoWithSession(page, "/videos");
    const card = page.getByRole("button", {
      name: "Открыть видео: CATALOG_VIDEO",
      exact: true,
    });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await card.boundingBox();
    const previous = state.reads.filter(
      (row) => row.name === "videos.catalog",
    ).length;
    const gate = deferred();
    state.catalogGate = gate.promise;
    try {
      await page.clock.fastForward(61_000);
      await page.clock.runFor(100);
      await expect
        .poll(
          () =>
            state.reads.filter((row) => row.name === "videos.catalog").length,
        )
        .toBe(previous + 1);
      await page.clock.runFor(100);
      expect(await card.boundingBox()).toEqual(before);
      await expect(
        page.locator('[data-tab-screen="/videos"] .ui-refresh'),
      ).toHaveCount(0);
    } finally {
      state.catalogGate = undefined;
      gate.resolve();
    }
    await expect(card).toBeVisible();
    expect(await card.boundingBox()).toEqual(before);
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
  const catalogReads = state.reads.filter(
    (row) => row.name === "videos.catalog",
  );
  // StrictMode may cancel and repeat the initial read; pagination must request one next page.
  expect(
    catalogReads.filter((row) => row.input.cursor !== undefined),
  ).toHaveLength(1);
  expect([
    ...new Map(
      catalogReads.map((row) => [JSON.stringify(row.input), row]),
    ).values(),
  ]).toEqual([
    { name: "videos.catalog", input: { limit: 20, ...thumbnailOptIn } },
    {
      name: "videos.catalog",
      input: { limit: 20, ...thumbnailOptIn, cursor: 42 },
    },
  ]);
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
const catalogCards = (page: Page) =>
  page.getByRole("button", { name: /^Открыть видео:/ });
const catalogReads = (state: Awaited<ReturnType<typeof fixture>>) =>
  state.reads.filter(
    (row) => row.name === "videos.catalog" && row.input.limit === 20,
  );
const catalogScroll = (page: Page) =>
  page.locator('[data-tab-screen="/videos"] .ui-scroll').first();

function catalogPages(state: Awaited<ReturnType<typeof fixture>>, count = 5) {
  for (let index = 0; index < count; index++)
    state.pages.set(index * 20, {
      items: Array.from({ length: 20 }, (_, offset) => ({
        ...card,
        id: index * 20 + offset + 1,
        title: `VIDEO_${index * 20 + offset + 1}`,
      })),
      nextCursor: index === count - 1 ? null : (index + 1) * 20,
    });
}
async function loadCatalog(page: Page, count = 5) {
  await gotoWithSession(page, "/videos");
  await expect(catalogCards(page)).toHaveCount(20);
  for (let index = 1; index < count; index++) {
    await page
      .getByRole("button", { name: "Показать ещё", exact: true })
      .click();
    await expect(catalogCards(page)).toHaveCount((index + 1) * 20);
  }
}
async function settleCatalogVisibility(page: Page) {
  // Clock advancement does not deliver native IntersectionObserver callbacks.
  // Wait for a browser observation before measuring the next polling cycle.
  await catalogScroll(page).evaluate(
    (root) =>
      new Promise<void>((resolve) => {
        const observer = new IntersectionObserver(
          () => {
            observer.disconnect();
            resolve();
          },
          { root },
        );
        observer.observe(root.querySelector("[data-item-index]")!);
      }),
  );
  await page.clock.runFor(200);
}
async function pullCatalog(page: Page) {
  await catalogScroll(page).evaluate((node) => {
    node.scrollTop = 0;
    for (const [type, property, y] of [
      ["touchstart", "touches", 0],
      ["touchend", "changedTouches", 200],
    ] as const) {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, property, {
        value: [{ identifier: 1, target: node, clientY: y }],
      });
      if (type === "touchend")
        Object.defineProperty(event, "touches", { value: [] });
      node.dispatchEvent(event);
    }
  });
}

test("bounded catalog: polling reads only the head and visible page; revisiting refreshes stale edits and deletions", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  catalogPages(state);
  await loadCatalog(page);
  await page
    .getByRole("button", { name: "Открыть видео: VIDEO_90", exact: true })
    .scrollIntoViewIfNeeded();
  await settleCatalogVisibility(page);
  const start = catalogReads(state).length;
  state.pages.get(80)!.items[9].title = "VISIBLE_EDIT";
  state.pages.get(40)!.items[4].title = "REVISITED_EDIT";
  state.pages.get(40)!.items = state.pages
    .get(40)!
    .items.filter((item) => item.id !== 44);
  await page.clock.fastForward(61_000);
  await settleCatalogVisibility(page);
  await expect(
    page.getByRole("button", { name: "Открыть видео: VISIBLE_EDIT" }),
  ).toBeVisible();
  expect(
    catalogReads(state)
      .slice(start)
      .map((row) => row.input.cursor ?? 0)
      .sort((a, b) => Number(a) - Number(b)),
  ).toEqual([0, 80]);
  const revisit = catalogReads(state).length;
  await page
    .getByRole("button", { name: "Открыть видео: VIDEO_45", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Открыть видео: REVISITED_EDIT" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Открыть видео: VIDEO_44", exact: true }),
  ).toHaveCount(0);
  expect(
    catalogReads(state)
      .slice(revisit)
      .map((row) => row.input.cursor),
  ).toEqual([40]);
  await expect(catalogCards(page)).toHaveCount(99);
  // At a page boundary both adjacent pages are visible: the budget is three.
  await page
    .getByRole("button", { name: "Открыть видео: VIDEO_60", exact: true })
    .scrollIntoViewIfNeeded();
  await settleCatalogVisibility(page);
  await expect.poll(() => catalogReads(state).at(-1)!.input.cursor).toBe(60);
  const boundary = catalogReads(state).length;
  await page.clock.fastForward(61_000);
  await settleCatalogVisibility(page);
  await expect.poll(() => catalogReads(state).length).toBe(boundary + 3);
  expect(
    catalogReads(state)
      .slice(boundary)
      .map((row) => row.input.cursor ?? 0)
      .sort((a, b) => Number(a) - Number(b)),
  ).toEqual([0, 40, 60]);
  expect(state.pageErrors).toEqual([]);
});

test("bounded catalog: a hidden screen and a hidden document do not poll; return refreshes the visible page", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  catalogPages(state);
  await loadCatalog(page);
  await page
    .getByRole("button", { name: "Открыть видео: VIDEO_90", exact: true })
    .scrollIntoViewIfNeeded();
  await settleCatalogVisibility(page);
  await page.getByRole("link", { name: "Лента", exact: true }).click();
  await expect(page.locator('[data-tab-screen="/videos"]')).toBeHidden();
  const hidden = catalogReads(state).length;
  await page.clock.fastForward(121_000);
  await settleCatalogVisibility(page);
  expect(catalogReads(state)).toHaveLength(hidden);
  state.pages.get(80)!.items[9].title = "RETURN_EDIT";
  await page.getByRole("link", { name: "Видео", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Открыть видео: RETURN_EDIT" }),
  ).toBeVisible();
  expect(
    catalogReads(state)
      .slice(hidden)
      .map((row) => row.input.cursor ?? 0)
      .sort((a, b) => Number(a) - Number(b)),
  ).toEqual([0, 80]);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  const background = catalogReads(state).length;
  await page.clock.fastForward(121_000);
  await settleCatalogVisibility(page);
  expect(catalogReads(state)).toHaveLength(background);
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
    delete (document as unknown as { visibilityState?: string })
      .visibilityState;
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  await expect.poll(() => catalogReads(state).length).toBe(background + 2);
});

test("bounded catalog: failed manual refresh retains all cards; success restarts and refetches the tail", async ({
  page,
}) => {
  const state = await fixture(page);
  catalogPages(state, 3);
  await loadCatalog(page, 3);
  state.catalogFailures.set(0, 500);
  await pullCatalog(page);
  await expect(
    page.getByText("Не удалось обновить видео", { exact: true }),
  ).toBeVisible();
  await expect(catalogCards(page)).toHaveCount(60);
  state.catalogFailures.clear();
  state.pages.get(20)!.items[0].title = "FRESH_TAIL";
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(catalogCards(page)).toHaveCount(20);
  const before = catalogReads(state).length;
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(catalogCards(page)).toHaveCount(40);
  await expect(
    page.getByRole("button", { name: "Открыть видео: FRESH_TAIL" }),
  ).toHaveCount(1);
  expect(
    catalogReads(state)
      .slice(before)
      .map((row) => row.input.cursor),
  ).toEqual([20]);
});

test("bounded catalog: a cached next-page error stays a pagination error and never restores stale cards", async ({
  page,
}) => {
  const state = await fixture(page);
  catalogPages(state, 2);
  await loadCatalog(page, 2);
  await pullCatalog(page);
  await expect(catalogCards(page)).toHaveCount(20);
  state.catalogFailures.set(20, 500);
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(
    page.getByText("Не удалось загрузить следующие видео", { exact: true }),
  ).toBeVisible();
  await expect(catalogCards(page)).toHaveCount(20);
  await expect(
    page.getByText("Не удалось обновить видео", { exact: true }),
  ).toHaveCount(0);
  state.catalogFailures.clear();
  state.pages.get(20)!.items[0].title = "RETRIED_CACHED_PAGE";
  const before = catalogReads(state).length;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(catalogCards(page)).toHaveCount(40);
  await expect(
    page.getByRole("button", { name: "Открыть видео: RETRIED_CACHED_PAGE" }),
  ).toHaveCount(1);
  expect(
    catalogReads(state)
      .slice(before)
      .map((row) => row.input.cursor),
  ).toEqual([20]);
});

test("bounded catalog: more than eight pages release old cards and return to an evicted page", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const state = await fixture(page);
  catalogPages(state, 12);
  await gotoWithSession(page, "/videos");
  await expect(catalogCards(page)).toHaveCount(20);
  for (let index = 1; index < 12; index++) {
    await page
      .getByRole("button", { name: "Показать ещё", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `Открыть видео: VIDEO_${(index + 1) * 20}`,
        exact: true,
      }),
    ).toHaveCount(1);
    expect(await catalogCards(page).count()).toBeLessThanOrEqual(160);
  }
  // One retained head serves polling; seven later pages form the visible window.
  await expect(catalogCards(page)).toHaveCount(140);
  await expect(
    page.getByRole("button", { name: "Открыть видео: VIDEO_1", exact: true }),
  ).toHaveCount(0);
  const previous = page.getByRole("button", {
    name: "Предыдущие видео",
    exact: true,
  });
  await previous.scrollIntoViewIfNeeded();
  const retained = page.getByRole("button", {
    name: "Открыть видео: VIDEO_101",
    exact: true,
  });
  const before = (await retained.boundingBox())!.y;
  const reads = catalogReads(state).length;
  await previous.click();
  await expect(
    page.getByRole("button", { name: "Открыть видео: VIDEO_81", exact: true }),
  ).toHaveCount(1);
  await expect(catalogCards(page)).toHaveCount(140);
  expect(
    catalogReads(state)
      .slice(reads)
      .map((row) => row.input.cursor),
  ).toEqual([80]);
  expect(Math.abs((await retained.boundingBox())!.y - before)).toBeLessThan(3);
  // A late previous-page response belongs to the old identity as well.
  state.pages.get(60)!.items[0].title = "OLD_PREVIOUS_PRIVATE";
  const gate = deferred();
  state.catalogGate = gate.promise;
  try {
    await previous.click();
    await expect.poll(() => catalogReads(state).at(-1)!.input.cursor).toBe(60);
    state.user = null;
    state.pages.set(0, {
      items: [{ ...card, id: 999, title: "GUEST_WINDOW" }],
      nextCursor: null,
    });
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "bounded-catalog-guest",
        }),
      ),
    );
    state.catalogGate = undefined;
    gate.resolve();
    await expect(
      page.getByRole("button", {
        name: "Открыть видео: GUEST_WINDOW",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("OLD_PREVIOUS_PRIVATE", { exact: true }),
    ).toHaveCount(0);
  } finally {
    state.catalogGate = undefined;
    gate.resolve();
  }
  expect(state.pageErrors).toEqual([]);
});

test("bounded catalog: a changed boundary discards disconnected pages and loads the new cursor", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  catalogPages(state, 3);
  await loadCatalog(page, 3);
  await page
    .getByRole("button", { name: "Открыть видео: VIDEO_1", exact: true })
    .scrollIntoViewIfNeeded();
  await settleCatalogVisibility(page);
  state.pages.set(0, {
    items: [
      ...state.pages.get(0)!.items.slice(0, 19),
      state.pages.get(20)!.items[0],
    ],
    nextCursor: 21,
  });
  state.pages.set(21, {
    items: [{ ...card, id: 22, title: "AFTER_NEW_CURSOR" }],
    nextCursor: null,
  });
  const before = catalogReads(state).length;
  await page.clock.fastForward(61_000);
  await expect(catalogCards(page)).toHaveCount(20);
  expect(
    catalogReads(state)
      .slice(before)
      .map((row) => row.input.cursor ?? 0),
  ).toEqual([0]);
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Открыть видео: AFTER_NEW_CURSOR" }),
  ).toBeVisible();
  await expect(catalogCards(page)).toHaveCount(21);
  expect(catalogReads(state).at(-1)!.input.cursor).toBe(21);
});

test("bounded catalog: a visible-page refresh error preserves confirmed cards and can be recovered", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  catalogPages(state, 3);
  await loadCatalog(page, 3);
  await page
    .getByRole("button", { name: "Открыть видео: VIDEO_50", exact: true })
    .scrollIntoViewIfNeeded();
  await settleCatalogVisibility(page);
  state.catalogFailures.set(40, 500);
  await page.clock.fastForward(61_000);
  await page.clock.runFor(2000);
  await expect(
    page.getByText("Не удалось обновить видео", { exact: true }),
  ).toBeVisible();
  await expect(catalogCards(page)).toHaveCount(60);
  await expect(
    page.getByRole("button", { name: "Открыть видео: VIDEO_50", exact: true }),
  ).toBeVisible();
  state.catalogFailures.clear();
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(catalogCards(page)).toHaveCount(20);
  expect(state.pageErrors).toEqual([]);
});

test("bounded catalog: an old account's late page cannot enter the guest catalog", async ({
  page,
}) => {
  const state = await fixture(page);
  catalogPages(state, 2);
  await gotoWithSession(page, "/videos");
  await expect(catalogCards(page)).toHaveCount(20);
  const gate = deferred();
  state.catalogGate = gate.promise;
  try {
    await page
      .getByRole("button", { name: "Показать ещё", exact: true })
      .click();
    await expect.poll(() => catalogReads(state).at(-1)!.input.cursor).toBe(20);
    state.user = null;
    state.pages.set(0, {
      items: [{ ...card, id: 999, title: "GUEST_CATALOG" }],
      nextCursor: null,
    });
    state.catalogGate = undefined;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button", { name: "Открыть видео: GUEST_CATALOG" }),
    ).toBeVisible();
    gate.resolve();
    await expect(catalogCards(page)).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: "Открыть видео: VIDEO_21",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(state.pageErrors).toEqual([]);
  } finally {
    state.catalogGate = undefined;
    gate.resolve();
  }
});

for (const guest of [false, true]) {
  test(`bounded catalog: next-page error retries only that cursor (${guest ? "guest" : "member"})`, async ({
    page,
  }) => {
    const state = await fixture(page);
    if (guest) state.user = null;
    catalogPages(state, 2);
    state.catalogFailures.set(20, 500);
    await gotoWithSession(page, "/videos");
    await page
      .getByRole("button", { name: "Показать ещё", exact: true })
      .click();
    await expect(
      page.getByText("Не удалось загрузить следующие видео", { exact: true }),
    ).toBeVisible();
    await expect(catalogCards(page)).toHaveCount(20);
    state.catalogFailures.clear();
    const before = catalogReads(state).length;
    await page.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect(catalogCards(page)).toHaveCount(40);
    expect(
      catalogReads(state)
        .slice(before)
        .map((row) => row.input.cursor),
    ).toEqual([20]);
  });
}

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
  // A development StrictMode remount can cancel the initial request and start another.
  await expect
    .poll(
      () => state.reads.filter((row) => row.name === "videos.playback").length,
    )
    .toBeGreaterThanOrEqual(1);
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

test("retrying a failed club file requires fresh playback authority before another media request", async ({
  page,
}) => {
  const state = await fixture(page);
  state.playback = {
    id: 42,
    provider: "youtube",
    youtubeId: "abc_DEF-123",
    videoUrl: "https://media.example.test/expired.mp4",
  };
  await page.route("https://media.example.test/**", (route) =>
    route.fulfill({ status: 404, body: "Unavailable" }),
  );
  await gotoWithSession(page, "/video/42");
  const retry = page.getByRole("button", {
    name: "Повторить загрузку видео",
    exact: true,
  });
  await expect(retry).toBeVisible();
  const before = state.reads.filter(
    (row) => row.name === "videos.playback",
  ).length;
  state.status = 403;
  await retry.click();
  await expect(
    page.getByText("Для просмотра нужен доступ к клубу", { exact: true }),
  ).toBeVisible();
  expect(
    state.reads.filter((row) => row.name === "videos.playback"),
  ).toHaveLength(before + 1);
  await expect(page.locator("video, iframe")).toHaveCount(0);
  expect(state.legacy).toEqual([]);
});
test("reloading a VK player requires fresh authority before restoring its iframe", async ({
  page,
}) => {
  const state = await fixture(page);
  const providerReply = deferred();
  await page.clock.install();
  await page.route(/https:\/\/vkvideo\.ru\/video_ext\.php\?/, async (route) => {
    state.providers.push(route.request().url());
    await providerReply.promise;
    await route
      .fulfill({ contentType: "text/html", body: "Synthetic player" })
      .catch(() => {});
  });
  try {
    await gotoWithSession(page, "/video/42");
    await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
    await expect.poll(() => state.providers.length).toBe(1);
    // Retry is offered only while the provider iframe has not finished loading.
    const retry = page.getByRole("button", {
      name: "Перезагрузить плеер VK",
      exact: true,
    });
    await expect(retry).toHaveCount(0);
    await page.clock.runFor(15_100);
    await expect(retry).toBeVisible();
    const before = state.reads.filter(
      (row) => row.name === "videos.playback",
    ).length;
    state.status = 403;
    await retry.click();
    await expect(
      page.getByText("Для просмотра нужен доступ к клубу", { exact: true }),
    ).toBeVisible();
    expect(
      state.reads.filter((row) => row.name === "videos.playback"),
    ).toHaveLength(before + 1);
    await expect(page.locator("iframe, video")).toHaveCount(0);
    expect(state.providers).toHaveLength(1);
    expect(state.legacy).toEqual([]);
  } finally {
    providerReply.resolve();
  }
});

test("pageshow requires new authority and keeps an old iframe removed", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/video/42");
  await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
  await expect.poll(() => state.providers.length).toBe(1);
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
  // A development StrictMode remount can cancel the initial request and start another.
  await expect
    .poll(
      () => state.reads.filter((row) => row.name === "videos.playback").length,
    )
    .toBeGreaterThanOrEqual(1);
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
  const load = page.getByRole("button", {
    name: "Загрузить видео",
    exact: true,
  });
  if (await load.count()) await load.click();
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
test("admin never converts a rejected YouTube detail into a VK update", async ({
  page,
}) => {
  const state = await openAdmin(page);
  state.detailStatus = 404;
  await page
    .getByRole("button", { name: "Редактировать по ID", exact: true })
    .click();
  await page.getByRole("textbox", { name: "ID видео VK" }).fill("18");
  await page
    .getByRole("button", { name: "Загрузить видео", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "не является VK",
  );
  await expect(
    page.getByRole("button", { name: "Сохранить видео", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toEqual([]);
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
  const retry = page.getByRole("button", {
    name: "Повторить сохранение",
    exact: true,
  });
  // Disabled fields also occur while the first request is still pending.
  // Keep its failure configured until the unknown-result UI is confirmed.
  await expect(retry).toBeVisible();
  state.saveStatus = 0;
  await retry.click();
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

test("old API mode does not expose cover writes", async ({ page }) => {
  test.skip(thumbnailsEnabled, "Checks the current deployed API mode.");
  await openAdmin(page);
  await expect(
    page.getByRole("textbox", { name: "Публичный адрес обложки VK" }),
  ).toHaveCount(0);
});

test.describe("documented thumbnail save contract", () => {
  test.skip(
    !thumbnailsEnabled,
    "Requires the separately enabled, synthetic thumbnail contract.",
  );
  const cover = "/assets/responsive/public-test-cover.webp";
  for (const intent of [
    "create",
    "keep",
    "replace",
    "remove",
    "clear",
  ] as const) {
    test(`cover intent ${intent} sends only the intended patch`, async ({
      page,
    }) => {
      const state = await openAdmin(page);
      if (intent !== "create") {
        await page
          .getByRole("button", { name: "Редактировать по ID", exact: true })
          .click();
        await page.getByRole("textbox", { name: "ID видео VK" }).fill("18");
      }
      await fillAdmin(page);
      const input = page.getByRole("textbox", {
        name: "Публичный адрес обложки VK",
      });
      if (["create", "replace", "clear"].includes(intent))
        await input.fill(cover);
      if (intent === "create") {
        await input.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: test.info().outputPath("thumbnail-admin-mobile.png"),
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await input.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: test.info().outputPath("thumbnail-admin-desktop.png"),
        });
        await page.setViewportSize({ width: 390, height: 844 });
      }
      if (intent === "remove")
        await page
          .getByRole("button", { name: "Удалить обложку", exact: true })
          .click();
      if (intent === "clear") await input.fill("");
      await page
        .getByRole("button", { name: "Сохранить видео", exact: true })
        .click();
      await expect(
        page.getByText(
          `Видео сохранено. ID: ${intent === "create" ? 42 : 18}`,
          { exact: true },
        ),
      ).toBeVisible();
      const expected =
        intent === "keep"
          ? {}
          : {
              thumbnailUrl: ["remove", "clear"].includes(intent) ? null : cover,
            };
      expect(state.writes).toEqual([
        {
          ...(intent === "create" ? {} : { id: 18, expectedRevision: 0 }),
          embedUrl: embed + "&autoplay=0",
          title: "VK_TITLE",
          access: "club",
          published: false,
          ...expected,
        },
      ]);
      expect(state.providers).toEqual([]);
    });
  }
  test("an invalid or whitespace cover remains editable without sending a write", async ({
    page,
  }) => {
    const state = await openAdmin(page);
    await fillAdmin(page);
    const input = page.getByRole("textbox", {
      name: "Публичный адрес обложки VK",
    });
    for (const value of [
      "https://vk.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh",
      "   ",
    ]) {
      await input.fill(value);
      await page
        .getByRole("button", { name: "Сохранить видео", exact: true })
        .click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Укажите публичный адрес обложки",
      );
      await expect(input).toBeEnabled();
      expect(state.writes).toEqual([]);
    }
  });
  for (const status of [400, 409]) {
    test(`a definite ${status} allows correction without an automatic replay`, async ({
      page,
    }) => {
      const state = await openAdmin(page);
      state.saveStatus = status;
      await fillAdmin(page);
      const input = page.getByRole("textbox", {
        name: "Публичный адрес обложки VK",
      });
      await input.fill(cover);
      await page
        .getByRole("button", { name: "Сохранить видео", exact: true })
        .click();
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(input).toBeEnabled();
      await expect(
        page.getByRole("button", { name: "Повторить сохранение", exact: true }),
      ).toHaveCount(0);
      expect(state.writes).toHaveLength(1);
    });
  }
  test("loss of a create response preserves the exact cover payload for explicit replay", async ({
    page,
  }) => {
    const state = await openAdmin(page);
    state.dropSaveResponse = true;
    await fillAdmin(page);
    const input = page.getByRole("textbox", {
      name: "Публичный адрес обложки VK",
    });
    await input.fill(cover);
    await page
      .getByRole("button", { name: "Сохранить видео", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Повторить сохранение", exact: true }),
    ).toBeVisible();
    await expect(input).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    state.dropSaveResponse = false;
    await page
      .getByRole("button", { name: "Повторить сохранение", exact: true })
      .click();
    await expect(
      page.getByText("Видео сохранено. ID: 42", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1]).toEqual(state.writes[0]);
    expect(state.writes[0]).toHaveProperty("thumbnailUrl", cover);
    expect(state.writes[0]).not.toHaveProperty("id");
  });
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

test("catalog covers support old and new pages without changing card geometry or fetching playback", async ({
  page,
}) => {
  const state = await fixture(page);
  const cover = "/assets/videos/catalog-test-cover.webp";
  const broken = "/assets/videos/catalog-test-broken.png";
  const image = await readFile(
    resolve(
      dirname(test.info().file),
      "../public/assets/responsive/78b61d3f13ad-ecZVWefzXRwRboPv.w900.6bd950f10a33771e.webp",
    ),
  );
  await page.route("**" + cover, (route) =>
    route.fulfill({ contentType: "image/webp", body: image }),
  );
  await page.route("**" + broken, (route) =>
    route.fulfill({ status: 404, body: "Unavailable" }),
  );
  state.pages.set(0, {
    items: [
      {
        ...card,
        id: 42,
        title: "COVER_PRESENT",
        access: "public",
        canWatch: true,
        thumbnailUrl: cover,
      },
      { ...card, id: 43, title: "COVER_NULL", thumbnailUrl: null },
      { ...card, id: 44, title: "COVER_OLD_API" },
      { ...card, id: 45, title: "COVER_FAILED", thumbnailUrl: broken },
    ],
    nextCursor: 45,
  });
  state.pages.set(45, {
    items: [
      {
        ...card,
        id: 42,
        title: "COVER_PRESENT",
        access: "public",
        canWatch: true,
        thumbnailUrl: cover,
      },
      { ...card, id: 46, title: "COVER_NEXT_PAGE", thumbnailUrl: cover },
    ],
    nextCursor: null,
  });
  await gotoWithSession(page, "/videos");
  const tile = (title: string) =>
    page.getByRole("button", { name: `Открыть видео: ${title}`, exact: true });
  const first = tile("COVER_PRESENT");
  await expect(first.locator("img")).toHaveAttribute("src", cover);
  await expect
    .poll(() =>
      first
        .locator("img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(first.getByText("Смотреть", { exact: true })).toBeVisible();
  const dimensions = await first.locator("img").evaluate((img) => ({
    width: img.getBoundingClientRect().width,
    height: img.getBoundingClientRect().height,
  }));
  for (const name of ["COVER_NULL", "COVER_OLD_API", "COVER_FAILED"]) {
    const item = tile(name);
    await item.scrollIntoViewIfNeeded();
    await expect(
      item.getByText("Обложка недоступна", { exact: true }),
    ).toBeVisible({ timeout: 12000 });
    const preview = item.locator("[data-video-thumbnail]");
    const bounds = await preview.evaluate((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }));
    // Firefox can report tiny floating-point differences after scrolling.
    expect(bounds.width).toBeCloseTo(dimensions.width, 2);
    expect(bounds.height).toBeCloseTo(dimensions.height, 2);
    await expect(
      item.getByText("Для участниц клуба", { exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(tile("COVER_NEXT_PAGE").locator("img")).toHaveAttribute(
    "src",
    cover,
  );
  await expect(first).toHaveCount(1);
  expect(state.reads.filter((row) => row.name === "videos.playback")).toEqual(
    [],
  );
  expect(state.providers).toEqual([]);
  expect(state.legacy).toEqual([]);
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("catalog-covers-mobile.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("catalog-covers-desktop.png"),
  });
});

for (const kind of ["file", "public-youtube"] as const) {
  test(`a failed ${kind} retries the authorized source once and clears its error after recovery`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.card.access = kind === "file" ? "club" : "public";
    state.playback = {
      id: 42,
      provider: "youtube",
      youtubeId: "abc_DEF-123",
      videoUrl: kind === "file" ? "https://media.example.test/old.webm" : null,
    };
    const bytes = await readFile(
      resolve(dirname(test.info().file), "fixtures/carousel-video.webm"),
    );
    let recovered = false,
      mediaReads = 0;
    const route =
      kind === "file"
        ? "https://media.example.test/**"
        : "**/api/yt/abc_DEF-123";
    await page.route(route, (r) => {
      mediaReads++;
      return recovered
        ? r.fulfill({ contentType: "video/webm", body: bytes })
        : r.fulfill({ status: 503, body: "Unavailable" });
    });
    await gotoWithSession(page, "/video/42");
    const retry = page.getByRole("button", {
      name: "Повторить загрузку видео",
      exact: true,
    });
    await expect(retry).toBeVisible();
    const before = state.reads.filter(
      (r) => r.name === "videos.playback",
    ).length;
    recovered = true;
    if (kind === "file")
      state.playback.videoUrl = "https://media.example.test/new.webm";
    await retry.click();
    await expect
      .poll(
        () => state.reads.filter((r) => r.name === "videos.playback").length,
      )
      .toBe(before + 1);
    await expect
      .poll(() =>
        page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
      )
      .toBeGreaterThanOrEqual(1);
    await expect(retry).toHaveCount(0);
    if (kind === "file") {
      await expect(page.locator("video")).toHaveAttribute(
        "src",
        "https://media.example.test/new.webm",
      );
      await expect(
        page.getByRole("button", {
          name: "Смотреть на YouTube →",
          exact: true,
        }),
      ).toHaveCount(0);
    }
    const completed = mediaReads;
    await page.waitForTimeout(200);
    expect(mediaReads).toBe(completed);
    expect(state.legacy).toEqual([]);
  });
}
