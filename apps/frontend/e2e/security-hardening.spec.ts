import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

/** Проверяем настоящий HTML и hydration с request-nonce: подложенный заголовок не выбирает nonce, а внедрённый в ответ inline-script блокируется браузером. */
test("document CSP permits hydration, changes per response and blocks injected inline scripts", async ({
  page,
  request,
}) => {
  await layoutApi(page);
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|script-src/.test(message.text()))
      violations.push(message.text());
  });
  const documentResponse = await request.get("/login", {
    headers: {
      "x-nonce": "attacker-selected",
      "Content-Security-Policy": "script-src 'unsafe-inline'",
    },
  });
  expect(documentResponse.status()).toBe(200);
  const csp = documentResponse.headers()["content-security-policy"];
  const nonce = csp.match(/'nonce-([^']+)'/)![1];
  expect(nonce).not.toBe("attacker-selected");
  const html = await documentResponse.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) expect(script).toContain(`nonce="${nonce}"`);
  expect(documentResponse.headers()["x-frame-options"]).toBe("DENY");
  expect(documentResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(documentResponse.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(documentResponse.headers()["cache-control"]).toContain("no-store");
  const another = await request.get("/login");
  expect(another.headers()["content-security-policy"]).not.toBe(csp);
  await gotoWithSession(page, "/login");
  await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
  await page.getByLabel("Email", { exact: true }).fill("member@example.test");
  await page
    .getByRole("button", {
      name: "Забыли пароль или ещё не установили его?",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Отправить инструкцию", exact: true }),
  ).toBeVisible();
  expect(violations).toEqual([]);
  // Simulate markup injection into an actual document response. DevTools
  // evaluation has special script privileges and is not a browser XSS boundary.
  await page.route("**/login", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "</head>",
        "<script>window.__untrustedInlineRan = true</script></head>",
      ),
    });
  });
  await gotoWithSession(page, "/login");
  await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
  expect(await page.evaluate(() => "__untrustedInlineRan" in window)).toBe(
    false,
  );
  await expect.poll(() => violations.length).toBeGreaterThan(0);
});

/** Два закрытых материала проверяем с недоступным и восстановленным API; ни ошибка, ни выключенный старый UI-флаг не должны открыть внешний публичный fallback. */
for (const [material, title] of [
  ["recipes", "Сборник рецептов"],
  ["peterburg", "Гид по Петербургу"],
] as const) {
  test(`${material}: uses private downloads even with the optional library flag off and never falls back`, async ({
    page,
  }) => {
    await layoutApi(page, true);
    let available = false;
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname === "disk.yandex.ru")
        externalRequests.push(request.url());
    });
    await page.route(`**/api/library/materials/${material}/files`, (route) =>
      available
        ? route.fulfill({
            json: {
              files: [
                {
                  fileKey: "main",
                  sortOrder: 0,
                  revision: 1,
                  filename: "material.pdf",
                  mimeType: "application/pdf",
                  fileSize: 123,
                  url: `/api/media/library-files/${material}/main`,
                },
              ],
              nextCursor: null,
            },
          })
        : route.fulfill({ status: 404, json: { error: "Unavailable" } }),
    );
    await gotoWithSession(page, "/library");
    await page
      .getByRole("button", { name: `Открыть материал: ${title}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog.getByRole("alert")).toContainText(
      "Материал сейчас недоступен",
    );
    await expect(dialog.getByRole("link")).toHaveCount(0);
    expect(page.context().pages()).toHaveLength(1);
    expect(externalRequests).toEqual([]);
    available = true;
    await dialog
      .getByRole("button", { name: "Повторить", exact: true })
      .click();
    await expect(dialog.getByRole("link")).toHaveAttribute(
      "href",
      `/api/media/library-files/${material}/main`,
    );
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ json: { user: null } }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(dialog).toHaveCount(0);
    expect(externalRequests).toEqual([]);
  });
}

/** Гость не отправляет запрос закрытого файла, а согласованный бесплатный сборник сохраняет отдельный внешний переход. */
test("guests cannot request club downloads and the free collection retains its link", async ({
  page,
}) => {
  await layoutApi(page);
  const reads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/library/materials/"))
      reads.push(request.url());
  });
  await gotoWithSession(page, "/library");
  await page
    .getByRole("button", {
      name: "Открыть материал: Сборник рецептов",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/club$/);
  expect(reads).toEqual([]);
  await gotoWithSession(page, "/library");
  const popupPromise = page.waitForEvent("popup");
  await page
    .context()
    .route("https://disk.yandex.ru/**", (route) =>
      route.fulfill({ body: "Public collection" }),
    );
  await page
    .getByRole("button", {
      name: "Открыть материал: Сборник стилизаций",
      exact: true,
    })
    .click();
  const popup = await popupPromise;
  await popup.waitForURL("https://disk.yandex.ru/i/Y-XvbPF-NwOiLg");
  expect(popup.url()).toContain("disk.yandex.ru/i/Y-XvbPF-NwOiLg");
  await popup.close();
});
