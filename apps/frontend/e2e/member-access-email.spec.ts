import { expect, test, type Page, type Route } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.use({ hasTouch: true });
const endpoint = "**/api/admin/access-email/resend";
const member = (id: number, name: string, extra = {}) => ({
  id,
  name,
  email: `member-${id}@example.test`,
  role: "user",
  createdAt: "2026-10-01T10:00:00Z",
  clubExpiresAt: "2040-11-01T10:00:00Z",
  blockedAt: null,
  blockedReason: null,
  ...extra,
});
const card = (page: Page, name = "Участница для письма") =>
  page.getByText(name, { exact: true }).locator("..");

async function fixtures(page: Page) {
  await editorApi(page, (name) => {
    if (name === "admin.members")
      return ok([
        member(201, "Участница для письма"),
        member(202, "Другая участница"),
        member(203, "Без почты", { email: null }),
        member(204, "С пустой почтой", { email: "" }),
        member(205, "Заблокирована", { blockedAt: "2026-10-08T10:00:00Z" }),
        member(206, "Истёкший клуб", { clubExpiresAt: "2000-01-01T10:00:00Z" }),
        member(207, "Без клуба", { clubExpiresAt: null }),
      ]);
  });
}
async function openMembers(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await expect(card(page)).toBeVisible();
}
async function send(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await card(page)
    .getByRole("button", { name: "Повторить письмо", exact: true })
    .click();
}

for (const width of [320, 390, 1440]) {
  test(`cancel and confirmed enqueue use the stored account without promising delivery at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await fixtures(page);
    const writes: { method: string; body: unknown; contentType: string }[] = [];
    await page.route(endpoint, async (route) => {
      const request = route.request();
      writes.push({
        method: request.method(),
        body: request.postDataJSON(),
        contentType: request.headers()["content-type"],
      });
      await route.fulfill({ status: 202, json: { queued: true } });
    });
    await openMembers(page);
    await expect(
      page.getByRole("button", { name: "Повторить письмо", exact: true }),
    ).toHaveCount(2);
    const button = card(page).getByRole("button", {
      name: "Повторить письмо",
      exact: true,
    });
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("member-201@example.test");
      await dialog.dismiss();
    });
    await button.tap();
    expect(writes).toEqual([]);
    await button.focus();
    await expect(button).toBeFocused();
    page.once("dialog", (dialog) => dialog.accept());
    await button.press("Enter");
    await expect(card(page).getByRole("status")).toHaveText(
      "Письмо с доступом поставлено в очередь. Доставка ещё не подтверждена.",
    );
    await expect(
      card(page).getByRole("button", { name: "Письмо в очереди", exact: true }),
    ).toBeDisabled();
    await expect(
      card(page, "Другая участница").getByRole("button", {
        name: "Повторить письмо",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(card(page).getByText("member-201@example.test")).toBeVisible();
    await expect(
      page.getByText(/Письмо отправлено|Письмо доставлено/),
    ).toHaveCount(0);
    expect(writes).toEqual([
      {
        method: "POST",
        body: { userId: 201 },
        contentType: "application/json",
      },
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card(page).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath(`access-email-${width}.png`),
    });
  });
}

for (const status of [400, 403, 429]) {
  test(`known ${status} refusal permits only an explicit retry and hides private details`, async ({
    page,
  }) => {
    await fixtures(page);
    let writes = 0;
    await page.route(endpoint, (route) => {
      writes++;
      return route.fulfill(
        writes === 1
          ? { status, json: { error: "PRIVATE_SMTP_DETAILS" } }
          : { status: 202, json: { queued: true } },
      );
    });
    await openMembers(page);
    await send(page);
    await expect(card(page).getByRole("alert")).toContainText(
      status === 400
        ? "Проверьте почту"
        : status === 403
          ? "Нет доступа"
          : "Слишком много",
    );
    await expect(page.getByText(/PRIVATE_SMTP_DETAILS/)).toHaveCount(0);
    await expect(card(page).getByRole("status")).toHaveCount(0);
    expect(writes).toBe(1);
    await send(page);
    await expect(card(page).getByRole("status")).toContainText(
      "поставлено в очередь",
    );
    expect(writes).toBe(2);
  });
}

const unconfirmed = [
  { label: "500", status: 500, body: { error: "PRIVATE_SMTP_DETAILS" } },
  { label: "false queued", status: 202, body: { queued: false } },
  { label: "missing queued", status: 202, body: {} },
  { label: "wrong success status", status: 200, body: { queued: true } },
  { label: "HTML", status: 202, body: "<html>PRIVATE_SMTP_DETAILS</html>" },
  { label: "network loss", status: 0, body: null },
];
for (const outcome of unconfirmed) {
  test(`${outcome.label} keeps the recipient blocked across members-tab changes`, async ({
    page,
  }) => {
    await fixtures(page);
    let writes = 0;
    await page.route(endpoint, (route) => {
      writes++;
      if (!outcome.status) return route.abort("failed");
      return route.fulfill({
        status: outcome.status,
        ...(typeof outcome.body === "string"
          ? { contentType: "text/html", body: outcome.body }
          : { json: outcome.body }),
      });
    });
    await openMembers(page);
    await send(page);
    await expect(card(page).getByRole("alert")).toContainText(
      "не подтверждена",
    );
    await expect(page.getByText(/PRIVATE_SMTP_DETAILS/)).toHaveCount(0);
    await page.getByRole("button", { name: "Посты", exact: true }).click();
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    const button = card(page).getByRole("button", {
      name: "Повторить письмо",
      exact: true,
    });
    await expect(button).toBeDisabled();
    await expect(card(page).getByRole("alert")).toContainText(
      "не подтверждена",
    );
    await button.evaluate((element: HTMLButtonElement) => element.click());
    expect(writes).toBe(1);
    await expect(
      card(page, "Другая участница").getByRole("button", {
        name: "Повторить письмо",
        exact: true,
      }),
    ).toBeEnabled();
  });
}

test("pending request excludes duplicates and other member writes; a late reply after tab change is not success", async ({
  page,
}) => {
  await fixtures(page);
  let writes = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    writes++;
    await held;
    await route
      .fulfill({ status: 202, json: { queued: true } })
      .catch(() => {});
  });
  await openMembers(page);
  await send(page);
  const pending = card(page).getByRole("button", {
    name: "Ставим в очередь…",
    exact: true,
  });
  await expect(pending).toBeDisabled();
  await pending.evaluate((element: HTMLButtonElement) => element.click());
  await expect(
    card(page).getByRole("button", { name: "Продлить клуб", exact: true }),
  ).toBeDisabled();
  await expect(
    card(page).getByRole("button", { name: "Заблокировать", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Посты", exact: true }).click();
  release();
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await expect(card(page).getByRole("alert")).toContainText("не подтверждена");
  await expect(
    card(page).getByRole("button", { name: "Повторить письмо", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
});

test("deadline retains an unknown outcome without retrying the request", async ({
  page,
}) => {
  await page.clock.install();
  await fixtures(page);
  let writes = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    writes++;
    await held;
    await route
      .fulfill({ status: 202, json: { queued: true } })
      .catch(() => {});
  });
  await openMembers(page);
  await send(page);
  await expect(
    card(page).getByRole("button", { name: "Ставим в очередь…", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(16_000);
  await expect(card(page).getByRole("alert")).toContainText("не подтверждена");
  await expect(
    card(page).getByRole("button", { name: "Повторить письмо", exact: true }),
  ).toBeDisabled();
  release();
  expect(writes).toBe(1);
});

for (const nextActor of [102, null]) {
  test(`late response after ${nextActor === null ? "session revocation" : "identity change"} cannot publish previous success`, async ({
    page,
  }) => {
    await fixtures(page);
    let actorId: number | null = 101;
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user:
            actorId === null
              ? null
              : {
                  id: actorId,
                  openId: `admin-${actorId}`,
                  name: "Администратор",
                  email: "admin@example.test",
                  role: "admin",
                  lastSignedIn: "2026-10-08T10:00:00Z",
                },
        },
      }),
    );
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(endpoint, async (route) => {
      await held;
      await route
        .fulfill({ status: 202, json: { queued: true } })
        .catch(() => {});
    });
    await openMembers(page);
    await send(page);
    await expect(
      card(page).getByRole("button", { name: "Ставим в очередь…" }),
    ).toBeDisabled();
    actorId = nextActor;
    const refreshed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/auth/me",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await refreshed;
    await expect(
      page.getByRole("button", { name: "Ставим в очередь…" }),
    ).toHaveCount(0);
    release();
    if (nextActor !== null) {
      await page
        .getByRole("button", { name: "Участницы", exact: true })
        .click();
      await expect(
        card(page).getByRole("button", {
          name: "Повторить письмо",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(card(page).getByRole("status")).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("button", { name: "Повторить письмо", exact: true }),
      ).toHaveCount(0);
    }
  });
}

for (const role of ["moderator", "user", "guest"]) {
  test(`${role} does not get the members action or trigger email`, async ({
    page,
  }) => {
    await fixtures(page);
    await page.route("**/api/auth/me", (route: Route) =>
      route.fulfill({
        json: {
          user:
            role === "guest"
              ? null
              : {
                  id: 102,
                  openId: "other-user",
                  name: "Пользователь",
                  email: "other@example.test",
                  role,
                  lastSignedIn: "2026-10-08T10:00:00Z",
                },
        },
      }),
    );
    let writes = 0;
    await page.route(endpoint, (route) => {
      writes++;
      return route.fulfill({ status: 202, json: { queued: true } });
    });
    await gotoWithSession(page, "/admin");
    await expect(
      page.getByRole("button", { name: "Повторить письмо", exact: true }),
    ).toHaveCount(0);
    expect(writes).toBe(0);
  });
}
