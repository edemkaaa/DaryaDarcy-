import { test, expect, type Page } from "@playwright/test";

const token = "A".repeat(43);
const secret = "synthetic-new-password";
const field = (page: Page) =>
  page.getByRole("textbox", { name: "Новый пароль", exact: true });
// Password inputs have no implicit textbox role until revealed.
const passwordField = (page: Page) =>
  page.getByLabel("Новый пароль", { exact: true });
const save = (page: Page) =>
  page.getByRole("button", { name: "Сохранить пароль", exact: true });

async function fixture(
  page: Page,
  reply?: (attempt: number) => {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
  },
) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const writes: Record<string, unknown>[] = [];
  const unexpected: string[] = [];
  const urls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => urls.push(request.url()));
  await page.context().addCookies([
    {
      name: "app_session",
      value: "existing-session-must-not-be-used",
      url: origin,
    },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("password-test-sentinel", "preserved");
    sessionStorage.setItem("password-test-sentinel", "preserved");
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      unexpected.push(url.origin);
      return route.abort();
    }
    if (url.pathname === "/api/auth/password/complete") {
      expect(request.method()).toBe("POST");
      expect(url.search).toBe("");
      expect(request.headers().cookie).toBeUndefined();
      expect(request.headers().referer).toBeUndefined();
      const body = request.postDataJSON();
      writes.push(body);
      expect(body).toEqual({ token, password: secret });
      const result = reply?.(writes.length) ?? {
        status: 200,
        body: { ok: true },
      };
      if (result.status === 0) return route.abort("failed");
      return route.fulfill({
        status: result.status,
        headers: result.headers,
        json: result.body ?? { ok: true },
      });
    }
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/media/")
    ) {
      unexpected.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  return { writes, unexpected, urls, errors };
}

for (const width of [320, 390, 1280]) {
  test(`isolated form uses the shared eye control and sends secrets only in POST at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await fixture(page);
    const response = await page.goto(`/password#token=${token}`);
    await expect(passwordField(page)).toBeEnabled();
    await expect(page).toHaveURL(/\/password$/);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["content-security-policy"]).toContain(
      "frame-src 'none'",
    );
    expect(response?.headers()["content-security-policy"]).toContain(
      "form-action 'none'",
    );
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /музыку/ })).toHaveCount(0);
    await passwordField(page).fill(secret);
    await passwordField(page).evaluate((input: HTMLInputElement) =>
      input.setSelectionRange(2, 7),
    );
    const eye = page.getByRole("button", {
      name: "Показать пароль",
      exact: true,
    });
    await expect(eye).toHaveText(/^[\ue8f4]$/);
    await eye.click();
    await expect(field(page)).toHaveAttribute("type", "text");
    await expect(field(page)).toBeFocused();
    await expect
      .poll(() =>
        field(page).evaluate((input: HTMLInputElement) => [
          input.selectionStart,
          input.selectionEnd,
        ]),
      )
      .toEqual([2, 7]);
    await page
      .getByRole("button", { name: "Скрыть пароль", exact: true })
      .click();
    await expect(passwordField(page)).toHaveAttribute("type", "password");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const inputStyle = await passwordField(page).evaluate((input) => ({
      font: getComputedStyle(input).fontSize,
      padding: getComputedStyle(input).paddingRight,
    }));
    expect(inputStyle).toEqual({ font: "18px", padding: "58px" });
    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
    expect(storage.local).toEqual({ "password-test-sentinel": "preserved" });
    expect(storage.session).toEqual({ "password-test-sentinel": "preserved" });
    expect(await page.content()).not.toContain(token);
    await page.screenshot({
      path: info.outputPath(`password-${width}.png`),
      fullPage: true,
    });
    await save(page).click();
    await expect(
      page.getByRole("heading", { name: "Пароль сохранён", exact: true }),
    ).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Войти", exact: true }),
    ).toHaveAttribute("href", "/login");
    expect(state.writes).toHaveLength(1);
    expect(state.unexpected).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(
      state.urls.every((url) => !url.includes(token) && !url.includes(secret)),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Откройте ссылку из письма" }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
  });
}

for (const fragment of [
  "",
  "#token=invalid",
  `#token=${token}&token=${token}`,
]) {
  test(`missing or malformed proof never enables submission (${fragment || "no fragment"})`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.goto(`/password${fragment}`);
    await expect(
      page.getByRole("heading", { name: "Откройте ссылку из письма" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/password$/);
    await expect(page.locator("form")).toHaveCount(0);
    expect(state.writes).toEqual([]);
    expect(state.unexpected).toEqual([]);
  });
}

test("a real expired-link response clears the form without granting a session", async ({
  page,
}) => {
  const state = await fixture(page, () => ({
    status: 400,
    body: { error: "PRIVATE_INTERNAL_DETAILS" },
  }));
  await page.goto(`/password#token=${token}`);
  await passwordField(page).fill(secret);
  await save(page).click();
  await expect(
    page.getByRole("heading", { name: "Откройте ссылку из письма" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "PRIVATE_INTERNAL_DETAILS",
  );
  expect(state.writes).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});

for (const status of [0, 503]) {
  test(`an unknown result ${status} offers login without an automatic second write`, async ({
    page,
  }) => {
    const state = await fixture(page, () => ({ status }));
    await page.goto(`/password#token=${token}`);
    await passwordField(page).fill(secret);
    await save(page).click();
    await expect(
      page.getByRole("heading", { name: "Проверьте сохранение пароля" }),
    ).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(state.unexpected).toEqual([]);
  });
}

test("429 preserves input but requires a manual retry after Retry-After", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page, (attempt) =>
    attempt === 1
      ? { status: 429, headers: { "Retry-After": "2" } }
      : { status: 200 },
  );
  await page.goto(`/password#token=${token}`);
  await passwordField(page).fill(secret);
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await expect(passwordField(page)).toHaveValue(secret);
  await page.clock.fastForward(2100);
  await expect(save(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  await save(page).click();
  await expect(
    page.getByRole("heading", { name: "Пароль сохранён", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
});

test("a pending save cannot be duplicated by submitting again", async ({
  page,
}) => {
  const state = await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/auth/password/complete", async (route) => {
    requests++;
    await gate;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/password#token=${token}`);
  await passwordField(page).fill(secret);
  await save(page).click();
  try {
    await expect(
      page.getByRole("button", { name: "Сохраняем…", exact: true }),
    ).toBeDisabled();
    await page
      .locator("form")
      .evaluate((form) =>
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
    expect(requests).toBe(1);
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Пароль сохранён", exact: true }),
  ).toBeVisible();
  expect(state.unexpected).toEqual([]);
});

test("leaving the document clears its in-memory proof and password before a cached return", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`/password#token=${token}`);
  await passwordField(page).fill(secret);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await expect(
    page.getByRole("heading", { name: "Откройте ссылку из письма" }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(page.locator("form")).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});
