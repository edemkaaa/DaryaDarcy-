import { expect, test, type Page } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { editorApi } from "./editor-fixtures";
import type {
  LaunchConfigurationSnapshot,
  Season,
} from "@shared/launch-settings";

test.use({ timezoneId: "America/Los_Angeles" });

const winter =
  "/assets/responsive/ea0b60bea0fe-EhNRvSBlhxWjRXfT.w1200.4cceecb893c4381e.webp";
const imageUrl = (season: string, kind: string) =>
  `https://seasons.example.test/${season}-${kind}.svg`;
const appearance = (season: Season) => ({
  startsOn: "11-20",
  backgroundUrl: imageUrl(season, "background"),
  bannerUrl: imageUrl(season, "banner"),
});
const publicConfig = (season: Season = "winter") => ({
  revision: 7,
  season,
  appearance: appearance(season),
  managerEmail: "manager@example.test",
  orderMethod: "email-client",
  capabilities: {
    smsLogin: false,
    penPals: false,
    shopOnlinePayment: false,
    webPush: false,
  },
});
const snapshot = (): LaunchConfigurationSnapshot => ({
  revision: 7,
  config: {
    timezone: "Europe/Moscow",
    seasonMode: "calendar",
    fixedSeason: "winter",
    managerEmail: "unchanged-manager@example.test",
    seasons: {
      winter: { startsOn: "11-20", backgroundUrl: null, bannerUrl: null },
      spring: { startsOn: "03-20", backgroundUrl: null, bannerUrl: null },
      summer: { startsOn: "06-01", backgroundUrl: null, bannerUrl: null },
      autumn: { startsOn: "09-01", backgroundUrl: null, bannerUrl: null },
    },
  },
});
const theme = (page: Page) => page.locator("[data-club-season]");
const background = (page: Page) => theme(page).locator(":scope > img");
const banner = (page: Page) =>
  page.getByTestId("club-season-banner").locator("img");
const form = (page: Page) =>
  page.getByRole("form", { name: "Настройки сезонов" });
const alert = (page: Page) => form(page).getByRole("alert");
async function images(page: Page) {
  await page.route("https://seasons.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#b3ad9b"/></svg>',
    }),
  );
}
async function clubApi(page: Page) {
  await layoutApi(page, true);
  await images(page);
}
async function openSettings(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Сезоны", exact: true }).click();
  await expect(form(page)).toBeVisible();
}

test("entry and reload keep a neutral background until the configured season arrives", async ({
  page,
}) => {
  await clubApi(page);
  let releaseConfiguration!: () => void;
  let configuration: Promise<void>;
  await page.route("**/api/launch-config", async (route) => {
    await configuration;
    await route.fulfill({ json: publicConfig("autumn") });
  });
  for (const entry of ["navigate", "reload"]) {
    configuration = new Promise<void>((resolve) => {
      releaseConfiguration = resolve;
    });
    if (entry === "navigate") await gotoWithSession(page, "/club");
    else await page.reload({ waitUntil: "domcontentloaded" });
    await expect(theme(page)).toHaveAttribute("data-club-season", "loading");
    await expect(background(page)).not.toHaveAttribute("src");
    await expect(banner(page)).toHaveCount(0);
    releaseConfiguration();
    await expect(theme(page)).toHaveAttribute("data-club-season", "autumn");
    await expect(background(page)).toHaveAttribute(
      "src",
      imageUrl("autumn", "background"),
    );
    await expect(banner(page)).toHaveAttribute(
      "src",
      imageUrl("autumn", "banner"),
    );
  }
});

test("a new season waits for both images while the confirmed pair stays visible", async ({
  page,
}) => {
  await clubApi(page);
  let season: Season = "autumn";
  await page.route("**/api/launch-config", (route) =>
    route.fulfill({ json: publicConfig(season) }),
  );
  let releaseBanner!: () => void;
  let bannerRequested!: () => void;
  const waitingForBanner = new Promise<void>((resolve) => {
    bannerRequested = resolve;
  });
  const bannerReady = new Promise<void>((resolve) => {
    releaseBanner = resolve;
  });
  await page.route(imageUrl("summer", "banner"), async (route) => {
    bannerRequested();
    await bannerReady;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#b3ad9b"/></svg>',
    });
  });
  await gotoWithSession(page, "/club");
  await expect(theme(page)).toHaveAttribute("data-club-season", "autumn");
  season = "summer";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await waitingForBanner;
  await expect(theme(page)).toHaveAttribute("data-club-season", "autumn");
  await expect(background(page)).toHaveAttribute(
    "src",
    imageUrl("autumn", "background"),
  );
  await expect(banner(page)).toHaveAttribute(
    "src",
    imageUrl("autumn", "banner"),
  );
  releaseBanner();
  await expect(theme(page)).toHaveAttribute("data-club-season", "summer");
  await expect(background(page)).toHaveAttribute(
    "src",
    imageUrl("summer", "background"),
  );
  await expect(banner(page)).toHaveAttribute(
    "src",
    imageUrl("summer", "banner"),
  );
});

for (const season of ["winter", "spring", "summer", "autumn"] as const) {
  test(`the server-selected ${season} appearance overrides the browser calendar`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-01-01T10:00:00Z") });
    await clubApi(page);
    await page.route("**/api/launch-config", (route) =>
      route.fulfill({ json: publicConfig(season) }),
    );
    await gotoWithSession(page, "/club");
    await expect(theme(page)).toHaveAttribute("data-club-season", season);
    await expect(background(page)).toHaveAttribute(
      "src",
      imageUrl(season, "background"),
    );
    await expect(banner(page)).toHaveAttribute(
      "src",
      imageUrl(season, "banner"),
    );
  });
}

test("Moscow midnight refreshes the server season even in a Los Angeles browser", async ({
  page,
}) => {
  // Load with running timers: pausing before hydration also freezes tRPC's
  // batch dispatch. Install earlier so pauseAt cannot target the past.
  await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
  await clubApi(page);
  let season: Season = "autumn";
  let reads = 0;
  await page.route("**/api/launch-config", (route) => {
    reads++;
    return route.fulfill({ json: publicConfig(season) });
  });
  await gotoWithSession(page, "/club");
  await expect(theme(page)).toHaveAttribute("data-club-season", "autumn");
  await page.clock.pauseAt(new Date("2026-11-19T20:59:58Z"));
  const before = reads;
  season = "winter";
  const refreshed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/launch-config",
  );
  await page.clock.fastForward(2100);
  await refreshed;
  // Let the response's React Query notifications render after the controlled
  // midnight crossing; the fixture has already switched to winter.
  await page.clock.resume();
  await expect(theme(page)).toHaveAttribute("data-club-season", "winter");
  expect(reads).toBeGreaterThan(before);
});

test("returning to Club and resuming the page refreshes changed settings while preserving the selected section", async ({
  page,
}) => {
  await clubApi(page);
  let season: Season = "autumn";
  await page.route("**/api/launch-config", (route) =>
    route.fulfill({ json: publicConfig(season) }),
  );
  await gotoWithSession(page, "/club");
  await page.getByRole("button", { name: "Комьюнити", exact: true }).click();
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "Лента", exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
  season = "spring";
  await page.getByRole("link", { name: "Клуб", exact: true }).click();
  await expect(theme(page)).toHaveAttribute("data-club-season", "spring");
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  season = "summer";
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(theme(page)).toHaveAttribute("data-club-season", "summer");
});

test("a failed background refresh retains the confirmed theme and offers an explicit retry", async ({
  page,
}) => {
  await clubApi(page);
  let fail = false;
  await page.route("**/api/launch-config", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: "PRIVATE_INTERNAL" } }
        : { json: publicConfig("spring") },
    ),
  );
  await gotoWithSession(page, "/club");
  await expect(theme(page)).toHaveAttribute("data-club-season", "spring");
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const warning = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось обновить оформление Клуба" });
  await expect(warning).toBeVisible();
  await expect(background(page)).toHaveAttribute(
    "src",
    imageUrl("spring", "background"),
  );
  await expect(page.getByText("PRIVATE_INTERNAL")).toHaveCount(0);
  fail = false;
  await warning.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(warning).toHaveCount(0);
});

for (const malformed of [false, true]) {
  test(`initial ${malformed ? "malformed" : "unavailable"} configuration uses winter fallback without hiding Club content`, async ({
    page,
  }) => {
    await clubApi(page);
    await page.route("**/api/launch-config", (route) =>
      route.fulfill(
        malformed
          ? {
              json: {
                ...publicConfig(),
                season: "unknown",
                appearance: {
                  ...appearance("winter"),
                  bannerUrl: "javascript:alert(1)",
                },
              },
            }
          : { status: 503, json: { error: "PRIVATE_INTERNAL" } },
      ),
    );
    await gotoWithSession(page, "/club");
    await expect(theme(page)).toHaveAttribute("data-club-season", "winter");
    await expect(banner(page)).toHaveAttribute("src", winter);
    await expect(
      page.getByRole("button", { name: "Комьюнити", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Не удалось обновить оформление Клуба" }),
    ).toBeVisible();
  });
}

test("missing and failed images fall back without changing the banner dimensions", async ({
  page,
}, testInfo) => {
  await clubApi(page);
  let failed = false;
  await page.route("**/api/launch-config", (route) =>
    route.fulfill({
      json: {
        ...publicConfig("summer"),
        appearance: {
          startsOn: "06-01",
          backgroundUrl: null,
          bannerUrl: failed ? imageUrl("summer", "broken") : null,
        },
      },
    }),
  );
  await page.route(imageUrl("summer", "broken"), (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await gotoWithSession(page, "/club");
  await expect(theme(page)).toHaveAttribute("data-club-season", "summer");
  await expect(banner(page)).toHaveAttribute("src", winter);
  const before = await page.getByTestId("club-season-banner").boundingBox();
  failed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Не удалось обновить оформление Клуба" }),
  ).toBeVisible();
  await expect(banner(page)).toHaveAttribute("src", winter);
  const after = await page.getByTestId("club-season-banner").boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  const warningBox = await page
    .getByRole("alert")
    .filter({ hasText: "Не удалось обновить оформление Клуба" })
    .boundingBox();
  expect(warningBox!.y).toBeGreaterThanOrEqual(after!.y + after!.height);
  await page.screenshot({
    path: testInfo.outputPath("winter-fallback-390.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("winter-fallback-1440.png"),
  });
});

test("owner settings save all four seasons once, preserve manager email and survive reopening", async ({
  page,
}, testInfo) => {
  await editorApi(page);
  let saved = snapshot();
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/admin/launch-settings", (route) => {
    if (route.request().method() === "PUT") {
      const input = route.request().postDataJSON();
      writes.push(input);
      saved = { revision: 8, config: input.config };
    }
    return route.fulfill({ json: saved });
  });
  await openSettings(page);
  await form(page)
    .getByRole("combobox", { name: "Режим смены сезонов", exact: true })
    .selectOption("fixed");
  await form(page)
    .getByRole("combobox", { name: "Фиксированный сезон", exact: true })
    .selectOption("winter");
  await form(page).getByLabel("Весна: дата начала").fill("03-21");
  await form(page)
    .getByLabel("Зима: фон")
    .fill(imageUrl("winter", "background"));
  const save = form(page).getByRole("button", {
    name: "Сохранить сезоны",
    exact: true,
  });
  await save.evaluate((node: HTMLButtonElement) => {
    node.click();
    node.click();
  });
  await expect(form(page).getByRole("status")).toContainText(
    "Настройки сезонов сохранены",
  );
  expect(writes).toEqual([{ expectedRevision: 7, config: saved.config }]);
  expect(saved.config.managerEmail).toBe("unchanged-manager@example.test");
  expect(saved.config.seasons.spring.startsOn).toBe("03-21");
  await page.getByRole("button", { name: "Посты", exact: true }).click();
  await page.getByRole("button", { name: "Сезоны", exact: true }).click();
  await expect(form(page).getByLabel("Весна: дата начала")).toHaveValue(
    "03-21",
  );
  await expect(form(page).getByLabel("Зима: фон")).toHaveValue(
    imageUrl("winter", "background"),
  );
  const autumnBanner = form(page).getByLabel("Осень: баннер");
  await autumnBanner.scrollIntoViewIfNeeded();
  await autumnBanner.click({ trial: true });
  const fieldBox = await autumnBanner.boundingBox();
  const tabsBox = await page
    .getByRole("navigation", { name: "Разделы", exact: true })
    .boundingBox();
  expect(fieldBox!.y + fieldBox!.height).toBeLessThanOrEqual(tabsBox!.y);
  await form(page)
    .getByRole("button", { name: "Сохранить сезоны", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("season-settings-390.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("season-settings-1440.png"),
  });
});

for (const [field, value, message] of [
  [
    "Весна: дата начала",
    "11-20",
    "Даты начала четырёх сезонов должны отличаться",
  ],
  ["Весна: дата начала", "02-29", "29 февраля не поддерживается"],
  ["Зима: фон", "http://seasons.example.test/image.svg", "HTTPS-ссылки"],
] as const) {
  test(`invalid season setting ${value} is rejected before dispatch`, async ({
    page,
  }) => {
    await editorApi(page);
    let writes = 0;
    await page.route("**/api/admin/launch-settings", (route) => {
      if (route.request().method() === "PUT") writes++;
      return route.fulfill({ json: snapshot() });
    });
    await openSettings(page);
    await form(page).getByLabel(field).fill(value);
    await form(page)
      .getByRole("button", { name: "Сохранить сезоны", exact: true })
      .click();
    await expect(alert(page)).toContainText(message);
    expect(writes).toBe(0);
    await expect(form(page).getByLabel(field)).toHaveValue(value);
  });
}

test("unknown save and failed inspection retain input; fresh unchanged settings permit only a manual retry", async ({
  page,
}) => {
  await editorApi(page);
  let writes = 0;
  let failRead = false;
  await page.route("**/api/admin/launch-settings", (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      return route.fulfill({
        status: 503,
        json: { error: "PRIVATE_INTERNAL" },
      });
    }
    return route.fulfill(
      failRead
        ? { status: 503, json: { error: "PRIVATE_INTERNAL" } }
        : { json: snapshot() },
    );
  });
  await openSettings(page);
  const field = form(page).getByLabel("Зима: фон");
  await field.fill(imageUrl("winter", "draft"));
  const save = form(page).getByRole("button", {
    name: "Сохранить сезоны",
    exact: true,
  });
  await save.click();
  await expect(alert(page)).toContainText("Сохранение не подтверждено");
  await expect(save).toBeDisabled();
  await expect(field).toHaveValue(imageUrl("winter", "draft"));
  failRead = true;
  await form(page)
    .getByRole("button", { name: "Проверить настройки", exact: true })
    .click();
  await expect(alert(page)).toContainText("Сервис временно недоступен");
  await expect(save).toBeDisabled();
  failRead = false;
  await form(page)
    .getByRole("button", { name: "Проверить настройки", exact: true })
    .click();
  await expect(save).toBeEnabled();
  expect(writes).toBe(1);
  await expect(field).toHaveValue(imageUrl("winter", "draft"));
});

test("a lost save reply is resolved by reading the matching revision without another PUT", async ({
  page,
}) => {
  await editorApi(page);
  let current = snapshot();
  let writes = 0;
  await page.route("**/api/admin/launch-settings", (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      current = { revision: 8, config: route.request().postDataJSON().config };
      return route.fulfill({ status: 503, json: { error: "lost" } });
    }
    return route.fulfill({ json: current });
  });
  await openSettings(page);
  await form(page).getByLabel("Зима: баннер").fill(imageUrl("winter", "new"));
  await form(page)
    .getByRole("button", { name: "Сохранить сезоны", exact: true })
    .click();
  await expect(alert(page)).toContainText("Сохранение не подтверждено");
  await form(page)
    .getByRole("button", { name: "Проверить настройки", exact: true })
    .click();
  await expect(form(page).getByRole("status")).toContainText(
    "Актуальные настройки совпадают",
  );
  await expect(
    form(page).getByRole("button", { name: "Сохранить сезоны", exact: true }),
  ).toBeDisabled();
  await expect(form(page).getByLabel("Зима: баннер")).toBeEnabled();
  expect(writes).toBe(1);
});

test("a revision conflict preserves draft and requires explicit replacement with the current settings", async ({
  page,
}) => {
  await editorApi(page);
  page.on("dialog", (dialog) => dialog.accept());
  let current = snapshot();
  let writes = 0;
  await page.route("**/api/admin/launch-settings", (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      current = snapshot();
      current.revision = 8;
      current.config.seasons.winter.bannerUrl = imageUrl(
        "winter",
        "someone-else",
      );
      return route.fulfill({
        status: 409,
        json: { error: "Настройки изменились" },
      });
    }
    return route.fulfill({ json: current });
  });
  await openSettings(page);
  const field = form(page).getByLabel("Зима: баннер");
  await field.fill(imageUrl("winter", "my-draft"));
  await form(page)
    .getByRole("button", { name: "Сохранить сезоны", exact: true })
    .click();
  await expect(alert(page)).toContainText("Настройки уже изменились");
  await form(page)
    .getByRole("button", { name: "Проверить настройки", exact: true })
    .click();
  await expect(alert(page)).toContainText("На сервере другая версия");
  await expect(field).toHaveValue(imageUrl("winter", "my-draft"));
  await form(page)
    .getByRole("button", {
      name: "Загрузить актуальные настройки",
      exact: true,
    })
    .click();
  await expect(field).toHaveValue(imageUrl("winter", "someone-else"));
  await expect(field).toBeEnabled();
  expect(writes).toBe(1);
});

test("malformed save confirmation does not clear the owner's draft", async ({
  page,
}) => {
  await editorApi(page);
  await page.route("**/api/admin/launch-settings", (route) =>
    route.fulfill({
      json: {
        ...snapshot(),
        revision: route.request().method() === "PUT" ? 8 : 7,
      },
    }),
  );
  await openSettings(page);
  const field = form(page).getByLabel("Зима: фон");
  await field.fill(imageUrl("winter", "draft"));
  await form(page)
    .getByRole("button", { name: "Сохранить сезоны", exact: true })
    .click();
  await expect(alert(page)).toContainText("Сохранение не подтверждено");
  await expect(field).toHaveValue(imageUrl("winter", "draft"));
  await expect(
    form(page).getByRole("button", { name: "Сохранить сезоны", exact: true }),
  ).toBeDisabled();
});

test("settings read failure offers retry without showing an empty editor", async ({
  page,
}) => {
  await editorApi(page);
  let fail = true;
  await page.route("**/api/admin/launch-settings", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: "PRIVATE_INTERNAL" } }
        : { json: snapshot() },
    ),
  );
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Сезоны", exact: true }).click();
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Не удалось загрузить настройки сезонов" });
  await expect(error).toBeVisible();
  await expect(form(page)).toHaveCount(0);
  fail = false;
  await error.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(form(page)).toBeVisible();
});

for (const role of ["user", "moderator"]) {
  test(`${role} has no season controls or protected configuration reads`, async ({
    page,
  }) => {
    await editorApi(page);
    let reads = 0;
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: 101,
            openId: "test-non-owner",
            name: "Участница",
            role,
            email: "user@example.test",
            lastSignedIn: "2026-10-08T10:00:00Z",
          },
        },
      }),
    );
    await page.route("**/api/admin/launch-settings", (route) => {
      reads++;
      return route.fulfill({ json: snapshot() });
    });
    await gotoWithSession(page, "/admin");
    await expect(
      page.getByText(
        role === "moderator"
          ? "Модерация"
          : "Недостаточно прав для управления приложением",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Сезоны", exact: true }),
    ).toHaveCount(0);
    expect(reads).toBe(0);
  });
}

test("revoking a session during settings save prevents a late success and closes private UI", async ({
  page,
}) => {
  await editorApi(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route("**/api/admin/launch-settings", async (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      const input = route.request().postDataJSON();
      await pending;
      await route
        .fulfill({ json: { revision: 8, config: input.config } })
        .catch(() => {});
    } else await route.fulfill({ json: snapshot() });
  });
  await openSettings(page);
  await form(page).getByLabel("Зима: баннер").fill(imageUrl("winter", "late"));
  await form(page)
    .getByRole("button", { name: "Сохранить сезоны", exact: true })
    .click();
  await expect.poll(() => writes).toBe(1);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: null } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(form(page)).toHaveCount(0);
  release();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText("Настройки сезонов сохранены.", { exact: true }),
  ).toHaveCount(0);
});
