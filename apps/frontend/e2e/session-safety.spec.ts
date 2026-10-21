import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession } from "./layout-fixtures";

test.setTimeout(45_000);
const member = (id: number) => ({
  id,
  openId: `member-${id}`,
  name: `Member ${id}`,
  email: `member-${id}@example.test`,
  phone: null,
  gender: "female" as const,
  avatarUrl: null,
  loginMethod: "email",
  role: "user",
  lastSignedIn: "2026-10-04T10:00:00Z",
});
type Member = ReturnType<typeof member>;
const failure = (status = 500) => ({
  error: {
    json: {
      message: "PRIVATE_INTERNAL_DETAILS",
      code: -32603,
      data: {
        code:
          status === 401
            ? "UNAUTHORIZED"
            : status === 404
              ? "NOT_FOUND"
              : "INTERNAL_SERVER_ERROR",
        httpStatus: status,
      },
    },
  },
});

async function mockApp(
  page: Page,
  current: () => Member | null = () => null,
  answer?: (name: string) => unknown,
) {
  await page.addInitScript(() => {
    localStorage.setItem("@darcy_install_guide_seen", "1");
    localStorage.setItem("darcy:user:1:@darcy_club_profile_completed", "true");
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: current() } }),
  );
  await page.route("**/api/capabilities", (route) =>
    route.fulfill({
      json: {
        smsLogin: false,
        penPals: false,
        shopOnlinePayment: false,
        webPush: false,
      },
    }),
  );
  await page.route("**/api/trpc/**", (route) => {
    const names = new URL(route.request().url()).pathname
      .split("/api/trpc/")[1]
      .split(",");
    const results = names.map((name) => {
      const custom = answer?.(name);
      if (custom !== undefined) return custom;
      let data: unknown = [];
      if (name === "club.subscription")
        data = {
          hasClubAccess: Boolean(current()),
          subscribed: Boolean(current()),
          expiresAt: current() ? "2040-11-01T10:00:00Z" : null,
          cancelAtPeriodEnd: false,
          isOwner: false,
          monthlyPrice: "790",
        };
      if (name === "feed.userInteractions")
        data = { likedIds: [], savedIds: [] };
      if (name === "feed.listPaginated" || name === "club.list")
        data = { posts: [], nextCursor: null };
      if (name === "admin.postsPage") data = { posts: [], nextCursor: null };
      if (name === "admin.postCounts")
        data = { total: 0, published: 0, scheduled: 0, draft: 0 };
      if (name === "admin.postCalendar") data = { days: [], upcoming: [] };
      if (name === "notifications.latest")
        data = { feedId: null, clubId: null };
      return { result: { data: { json: data } } };
    });
    return route.fulfill({
      json:
        new URL(route.request().url()).searchParams.get("batch") === "1"
          ? results
          : results[0],
    });
  });
}
async function enter(page: Page, email: string) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill("Test-only-password");
  await page.getByRole("button", { name: /^Войти(?: →)?$/ }).click();
}

test("a delayed initial session check cannot undo a successful login", async ({
  page,
}) => {
  let current: Member | null = null;
  await mockApp(page, () => current);
  // Login must work even if the decorative background never finishes loading.
  let pendingDecorations = 0;
  await page.route(
    /(?:https:\/\/s3\.twcstorage\.ru\/|\/assets\/responsive\/|\/_next\/static\/media\/).*\.(?:png|jpe?g|webp)(?:\?.*)?$/i,
    () => {
      pendingDecorations++;
    },
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  let initialSettled = false;
  let initial = true;
  await page.route("**/api/auth/me", async (route) => {
    if (initial) {
      initial = false;
      markStarted();
      await held;
      await route.fulfill({ json: { user: null } }).catch(() => {});
      initialSettled = true;
    } else await route.fulfill({ json: { user: current } });
  });
  await page.route("**/api/auth/login", (route) => {
    current = member(2);
    return route.fulfill({ json: { user: current } });
  });
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await started;
    await enter(page, "member-2@example.test");
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByText("member-2@example.test", { exact: true }),
    ).toBeVisible();
    expect(pendingDecorations).toBeGreaterThan(0);
    release();
    await expect.poll(() => initialSettled).toBe(true);
    await expect(
      page.getByText("member-2@example.test", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Войдите, чтобы открыть личный кабинет", { exact: false }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});

test("switching people cannot transfer local profile or quiz data", async ({
  page,
}) => {
  let current: Member | null = member(1);
  await mockApp(page, () => current);
  await page.addInitScript(() => {
    localStorage.setItem(
      "darcy:user:1:@darcy_club_profile_name",
      "First person's private name",
    );
    localStorage.setItem(
      "darcy:user:1:@darcy_quiz_result",
      JSON.stringify({
        primaryKey: "cottagecore",
        primaryTitle: "PRIVATE_QUIZ",
        secondaryKey: null,
        isBlend: false,
      }),
    );
  });
  await page.route("**/api/auth/logout", (route) => {
    current = null;
    return route.fulfill({ json: { success: true } });
  });
  await page.route("**/api/auth/login", (route) => {
    current = member(2);
    return route.fulfill({ json: { user: current } });
  });
  await page.goto("/profile");
  await expect(
    page.getByRole("button", { name: "Member 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("First person's private name", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.getByRole("button", { name: /^Войти(?: →)?$/ }).click();
  await enter(page, "member-2@example.test");
  await expect(
    page.getByText("member-2@example.test", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("First person's private name", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("darcy:user:1:@darcy_quiz_result"),
    ),
  ).toBeNull();
});

test("failed logout hides private UI and survives reload until confirmed", async ({
  page,
}) => {
  let current: Member | null = member(1);
  let fail = true;
  await mockApp(page, () => current);
  await page.route("**/api/auth/logout", (route) => {
    if (fail) return route.fulfill({ status: 503, json: { error: "offline" } });
    current = null;
    return route.fulfill({ json: { success: true } });
  });
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByText("Локальный доступ закрыт.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("member-1@example.test", { exact: true }),
  ).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Локальный доступ закрыт.", { exact: false }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByText("Войдите, чтобы открыть личный кабинет", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("darcy:logout-pending")),
  ).toBeNull();
});

test("session network failure offers retry rather than claiming the person is a guest", async ({
  page,
}) => {
  await mockApp(page);
  let fail = true;
  await page.route("**/api/auth/me", (route) =>
    fail ? route.abort("failed") : route.fulfill({ json: { user: null } }),
  );
  await page.goto("/profile", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Проверьте соединение", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Войти(?: →)?$/ }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Войти(?: →)?$/ }),
  ).toBeVisible();
});

test("native form submission never puts credentials in the URL", async ({
  page,
}) => {
  await mockApp(page);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("native@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("NATIVE_TEST_SECRET");
  await page.evaluate(() =>
    HTMLFormElement.prototype.submit.call(document.querySelector("form")),
  );
  await expect(page).toHaveURL(/\/login\?form=unavailable$/);
  expect(page.url()).not.toMatch(/password|NATIVE_TEST_SECRET|native@example/);
  await expect(page.getByRole("alert")).toContainText(
    "Форма ещё не была готова",
  );
});

test("email rate limiting prevents immediate repeated submissions", async ({
  page,
}) => {
  await mockApp(page);
  let calls = 0;
  await page.route("**/api/auth/login", (route) => {
    calls++;
    return route.fulfill({
      status: 429,
      headers: { "Retry-After": "2" },
      json: { error: "Слишком много запросов" },
    });
  });
  await gotoWithSession(page, "/login");
  await enter(page, "member@example.test");
  await expect(page.getByRole("status")).toContainText("Повторить можно через");
  await expect(
    page.getByRole("button", { name: /^Войти(?: →)?$/ }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  await expect(
    page.getByRole("button", { name: /^Войти(?: →)?$/ }),
  ).toBeEnabled({ timeout: 5000 });
});

test("malformed session data is shown as a recoverable response error", async ({
  page,
}) => {
  await mockApp(page);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: { id: 1 } } }),
  );
  await page.goto("/profile");
  await expect(
    page.getByText("Некорректный ответ сервера", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
});

test("video API errors offer retry and preserve a real not-found state", async ({
  page,
}) => {
  let status = 500;
  await mockApp(
    page,
    () => null,
    (name) => (name === "videos.getById" ? failure(status) : undefined),
  );
  await page.goto("/video/1");
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Видео не найдено", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("PRIVATE_INTERNAL_DETAILS", { exact: false }),
  ).toHaveCount(0);
  status = 404;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByText("Видео не найдено", { exact: true }),
  ).toBeVisible();
});

test("malformed content IDs do not cause API calls", async ({ page }) => {
  let calls = 0;
  await mockApp(
    page,
    () => null,
    (name) => {
      if (name === "videos.getById") calls++;
      return undefined;
    },
  );
  await page.goto("/video/12abc");
  await expect(
    page.getByText("Видео не найдено", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(0);
});

test("subscription failure does not become a confirmed absent subscription", async ({
  page,
}) => {
  await mockApp(
    page,
    () => member(1),
    (name) => (name === "club.subscription" ? failure() : undefined),
  );
  await page.goto("/club");
  await expect(
    page.getByText("Не удалось проверить подписку", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
});

test("an expired session closes private data after a protected query returns 401", async ({
  page,
}) => {
  let current: Member | null = member(1);
  await mockApp(
    page,
    () => current,
    (name) => {
      if (name !== "feed.savedPosts") return undefined;
      current = null;
      return failure(401);
    },
  );
  await page.goto("/profile");
  await expect(
    page.getByRole("button", { name: /^Войти(?: →)?$/ }),
  ).toBeVisible();
  await expect(
    page.getByText("member-1@example.test", { exact: true }),
  ).toHaveCount(0);
});

test("logout is reflected in another tab", async ({ page, context }) => {
  let current: Member | null = member(1);
  await mockApp(page, () => current);
  await page.route("**/api/auth/logout", (route) => {
    current = null;
    return route.fulfill({ json: { success: true } });
  });
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByText("member-1@example.test", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await mockApp(other, () => current);
  await other.route("**/api/auth/logout", (route) => {
    current = null;
    return route.fulfill({ json: { success: true } });
  });
  await gotoWithSession(other, "/profile");
  await expect(
    other.getByText("member-1@example.test", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    other.getByRole("button", { name: /^Войти(?: →)?$/ }),
  ).toBeVisible();
  await expect(
    other.getByText("member-1@example.test", { exact: true }),
  ).toHaveCount(0);
});

test("late registration completion cannot redirect a screen the user left", async ({
  page,
}) => {
  await mockApp(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/register", async (route) => {
    await held;
    await route
      .fulfill({ status: 202, json: { ok: true, message: "Проверьте почту" } })
      .catch(() => {});
  });
  await gotoWithSession(page, "/login");
  await page
    .getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("member@example.test");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Получить письмо", exact: true })
    .click();
  await gotoWithSession(page, "/interactive");
  release();
  await expect(page).toHaveURL(/\/interactive$/);
  await expect(page.getByText("Проверьте почту", { exact: true })).toHaveCount(
    0,
  );
});

test("a temporary session check failure preserves an administrator's unsaved text", async ({
  page,
}) => {
  const administrator = { ...member(1), role: "admin" };
  await mockApp(page, () => administrator);
  let offline = false;
  await page.route("**/api/auth/me", (route) =>
    offline
      ? route.abort("failed")
      : route.fulfill({ json: { user: administrator } }),
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: /^Новый пост$/ }).click();
  const text = page.getByPlaceholder("Текст поста… Enter — новый абзац");
  await text.fill("UNSAVED_TEST_DRAFT");
  offline = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("Не удалось обновить сессию", { exact: false }),
  ).toBeVisible();
  await expect(text).toHaveValue("UNSAVED_TEST_DRAFT");
  offline = false;
  // Network recovery bypasses paired focus/visibility event suppression and
  // keeps the editor's focus trap intact.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Не удалось обновить сессию", { exact: false }),
  ).toHaveCount(0);
  await expect(text).toHaveValue("UNSAVED_TEST_DRAFT");
});

test("a string subscription flag never grants club access", async ({
  page,
}) => {
  await mockApp(
    page,
    () => member(1),
    (name) =>
      name === "club.subscription"
        ? {
            result: {
              data: {
                json: {
                  hasClubAccess: true,
                  subscribed: "true",
                  cancelAtPeriodEnd: false,
                  expiresAt: "2040-11-01T10:00:00Z",
                  isOwner: false,
                  monthlyPrice: "790",
                },
              },
            },
          }
        : undefined,
  );
  await page.goto("/club");
  await expect(
    page.getByText("Не удалось проверить подписку", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
});

async function rememberScreen(page: Page) {
  const verticalScroll = page
    .locator("main .ui-scroll:not(.ui-scroll-horizontal)")
    .first();
  await verticalScroll.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const node = (await verticalScroll.elementHandle())!;
  const scrollTop = await node.evaluate((element) => {
    element.scrollTop = 650;
    return element.scrollTop;
  });
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documentRequests++;
  });
  return {
    async expectPreserved() {
      expect(await node.evaluate((element) => element.isConnected)).toBe(true);
      expect(await node.evaluate((element) => element.scrollTop)).toBe(
        scrollTop,
      );
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(
        timeOrigin,
      );
      expect(documentRequests).toBe(0);
    },
    scrollTop,
  };
}

async function returnToWindow(page: Page, event = "visibilitychange") {
  await page.evaluate((event) => {
    (event === "focus" ? window : document).dispatchEvent(
      new Event(event, { bubbles: true }),
    );
  }, event);
}

for (const event of ["focus", "visibilitychange"]) {
  test(`a guest's club scroll survives a pending ${event} session check`, async ({
    page,
  }) => {
    await mockApp(page);
    await gotoWithSession(page, "/club");
    const screen = await rememberScreen(page);
    expect(screen.scrollTop).toBe(650);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    await page.route("**/api/auth/me", async (route) => {
      calls++;
      await held;
      await route.fulfill({ json: { user: null } });
    });
    try {
      await returnToWindow(page, event);
      await expect.poll(() => calls).toBe(1);
      await screen.expectPreserved();
      // Browsers may deliver both events for one return to the application.
      await returnToWindow(
        page,
        event === "focus" ? "visibilitychange" : "focus",
      );
      await screen.expectPreserved();
      expect(calls).toBe(1);
      const settled = page.waitForResponse((response) =>
        response.url().endsWith("/api/auth/me"),
      );
      release();
      await settled;
      await screen.expectPreserved();
    } finally {
      release();
    }
  });
}

test("a guest's club scroll survives a failed background check and retry", async ({
  page,
}) => {
  await mockApp(page);
  await gotoWithSession(page, "/club");
  const screen = await rememberScreen(page);
  let offline = true;
  await page.route("**/api/auth/me", (route) =>
    offline ? route.abort("failed") : route.fulfill({ json: { user: null } }),
  );
  await returnToWindow(page, "focus");
  await expect(
    page.getByRole("status").filter({
      hasText: "Не удалось обновить сессию",
    }),
  ).toContainText("Не удалось обновить сессию");
  await screen.expectPreserved();
  offline = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByText("Не удалось обновить сессию", { exact: false }),
  ).toHaveCount(0);
  await screen.expectPreserved();
});

for (const problem of ["network", "503"]) {
  test(`profile scroll survives a temporary background session ${problem} failure`, async ({
    page,
  }) => {
    await mockApp(page, () => member(1));
    await gotoWithSession(page, "/profile");
    await expect(
      page.getByText("member-1@example.test", { exact: true }),
    ).toBeVisible();
    const screen = await rememberScreen(page);
    expect(screen.scrollTop).toBeGreaterThan(0);
    let fail = true;
    await page.route("**/api/auth/me", (route) =>
      !fail
        ? route.fulfill({ json: { user: member(1) } })
        : problem === "network"
          ? route.abort("failed")
          : route.fulfill({ status: 503, json: { error: "TEST_UNAVAILABLE" } }),
    );
    await returnToWindow(page, "focus");
    await expect(page.getByRole("status")).toContainText(
      "Не удалось обновить сессию",
    );
    await expect(
      page.getByText("member-1@example.test", { exact: true }),
    ).toBeAttached();
    await screen.expectPreserved();
    if (problem === "503")
      await page.screenshot({
        path: test.info().outputPath("background-session-warning.png"),
      });
    fail = false;
    await page.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect(
      page.getByText("Не удалось обновить сессию", { exact: false }),
    ).toHaveCount(0);
    await screen.expectPreserved();
  });
}

for (const problem of ["network", "503"]) {
  test(`the selected club section survives a temporary subscription ${problem} failure`, async ({
    page,
  }) => {
    let fail = false;
    await mockApp(
      page,
      () => member(1),
      (name) =>
        name === "club.subscription" && fail ? failure(503) : undefined,
    );
    if (problem === "network") {
      await page.route("**/api/trpc/**", (route) =>
        fail &&
        new URL(route.request().url()).pathname.includes("club.subscription")
          ? route.abort("failed")
          : route.fallback(),
      );
    }
    await gotoWithSession(page, "/club");
    const tab = page.getByRole("button", { name: "Подборки", exact: true });
    await tab.click();
    const screen = await rememberScreen(page);
    fail = true;
    await returnToWindow(page);
    await expect(page.getByRole("status")).toContainText(
      "Не удалось обновить подписку",
    );
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    await screen.expectPreserved();
    fail = false;
    await page
      .getByRole("status")
      .filter({ hasText: "Не удалось обновить подписку" })
      .getByRole("button", { name: "Повторить", exact: true })
      .click();
    await expect(
      page.getByText("Не удалось обновить подписку", { exact: false }),
    ).toHaveCount(0);
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    await screen.expectPreserved();
  });
}

test("a confirmed subscription revocation still removes the private club screen", async ({
  page,
}) => {
  let subscribed = true;
  await mockApp(
    page,
    () => member(1),
    (name) =>
      name === "club.subscription"
        ? {
            result: {
              data: {
                json: {
                  hasClubAccess: subscribed,
                  subscribed,
                  cancelAtPeriodEnd: false,
                  expiresAt: subscribed ? "2040-11-01T10:00:00Z" : null,
                  isOwner: false,
                  monthlyPrice: "790",
                },
              },
            },
          }
        : undefined,
  );
  await gotoWithSession(page, "/club");
  await page.getByRole("button", { name: "Подборки", exact: true }).click();
  subscribed = false;
  await returnToWindow(page);
  await expect(
    page.getByRole("button", { name: "Подборки", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Не удалось проверить подписку", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Не удалось обновить подписку", { exact: false }),
  ).toHaveCount(0);
});

test("a subscription permission denial never keeps the previously active club visible", async ({
  page,
}) => {
  let denied = false;
  await mockApp(
    page,
    () => member(1),
    (name) =>
      name === "club.subscription" && denied ? failure(403) : undefined,
  );
  await gotoWithSession(page, "/club");
  await page.getByRole("button", { name: "Подборки", exact: true }).click();
  denied = true;
  await returnToWindow(page);
  await expect(
    page.getByText("Не удалось проверить подписку", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Подборки", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Не удалось обновить подписку", { exact: false }),
  ).toHaveCount(0);
});

test("a 401 during an offline session recheck still closes the profile", async ({
  page,
}) => {
  let unauthorized = false;
  await mockApp(
    page,
    () => member(1),
    (name) =>
      // Only access checks refetch on focus; saved content stays cached.
      name === "club.subscription" && unauthorized ? failure(401) : undefined,
  );
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByText("member-1@example.test", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/auth/me", (route) => route.abort("failed"));
  unauthorized = true;
  await returnToWindow(page);
  await expect(
    page.getByText("Проверьте соединение", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("member-1@example.test", { exact: true }),
  ).toHaveCount(0);
});
