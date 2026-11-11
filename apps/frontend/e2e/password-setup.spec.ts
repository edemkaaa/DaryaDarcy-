import { test, expect, type Page } from "@playwright/test";

const token = "A".repeat(43);
const secret = "synthetic-new-password";
/** Текстовый textbox появляется только при раскрытом пароле; скрытый input имеет другой доступный locator. */
const field = (page: Page) =>
  page.getByRole("textbox", { name: "Новый пароль", exact: true });
// Password inputs have no implicit textbox role until revealed.
/** Label адресует password-input независимо от переключения видимости. */
const passwordField = (page: Page) =>
  page.getByLabel("Новый пароль", { exact: true });
/** Выбираем единственное подтверждение нового пароля из изолированной формы. */
const save = (page: Page) =>
  page.getByRole("button", { name: "Сохранить пароль", exact: true });

/** Разрешаем только same-origin assets и password-complete; проверяем POST без cookie/referrer и отсутствие token/password в URL, сохраняя прочие storage-ключи. */
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

/** Проверяем изолированную форму, eye-control, selection и исчезновение fragment до записи, затем удаление формы после подтверждения. */
for (const width of [320, 390, 1280]) {
  test(`isolated form uses the shared eye control and sends secrets only in POST at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await fixture(page);
    const response = await page.goto(`/password#token=${token}`);
    await expect(passwordField(page)).toBeEnabled();
    await expect(page.getByText("Новый пароль", { exact: true })).toHaveCount(
      0,
    );
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

/** Отсутствующий, короткий или дублирующийся proof не разрешает форму и удаляется из видимого URL. */
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

/** Контролируемый 400 трактуется как непригодная ссылка без выдачи сессии и без внутренних деталей в UI. */
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

/** Неизвестный результат не разрешает автоматический второй write: вместо формы остаётся предложение проверить вход. */
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

/** Rate-limit сохраняет ввод, но разрешает только ручной повтор после Retry-After. */
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

/** Удерживаем save на трёх ширинах: pending сохраняет геометрию и защищает от повторного native-submit. */
for (const width of [320, 390, 1280]) {
  test(`a pending save keeps button geometry and cannot be duplicated at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
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
    await page.evaluate(() => document.fonts.ready);
    const before = await save(page).boundingBox();
    expect(before).not.toBeNull();
    await save(page).click();
    try {
      const pending = page.getByRole("button", {
        name: "Сохраняем…",
        exact: true,
      });
      await expect(pending).toBeDisabled();
      const after = await pending.boundingBox();
      expect(after).not.toBeNull();
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(after![dimension]).toBeCloseTo(before![dimension], 1);
      }
      const spinner = await pending
        .getByRole("status", { name: "Сохраняем пароль", exact: true })
        .boundingBox();
      const label = await pending
        .getByText("Сохраняем…", { exact: true })
        .boundingBox();
      expect(spinner).not.toBeNull();
      expect(label).not.toBeNull();
      expect(spinner!.y + spinner!.height / 2).toBeCloseTo(
        after!.y + after!.height / 2,
        0,
      );
      expect(label!.y + label!.height / 2).toBeCloseTo(
        after!.y + after!.height / 2,
        0,
      );
      expect(spinner!.x + spinner!.width).toBeLessThan(label!.x);
      await page.screenshot({
        path: info.outputPath(`password-pending-${width}.png`),
        fullPage: true,
      });
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
}

/** Pagehide очищает proof и пароль в памяти; bfcache-подобный pageshow не восстанавливает форму. */
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
