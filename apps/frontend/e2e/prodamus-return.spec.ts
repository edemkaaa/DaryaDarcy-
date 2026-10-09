import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok } from "./editor-fixtures";

test.skip(
  process.env.PRODAMUS_RETURN_UI_ENABLED !== "true",
  "Requires an explicit Prodamus TEST frontend build; no provider or working API.",
);

const token =
  "club-test-101-00000000-0000-4000-8000-000000000001.1792000000." +
  "a".repeat(64);
const returned = `/club?paid=1#paymentReturn=${token}`;
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Результат оплаты клуба", exact: true });
async function fixture(page: Page, member = false) {
  await layoutApi(page, member);
  const state = {
    reads: 0,
    accessReads: 0,
    claims: 0,
    result: {
      state: "succeeded",
      nextAction: "setup",
      emailStatus: "sent",
    } as unknown,
  };
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    if (
      !names.some(
        (name) => name === "club.subscription" || name === "club.claimPending",
      )
    )
      return route.fallback();
    const values = names.map((name) => {
      if (name === "club.subscription") {
        state.accessReads++;
        const subscribed = member && state.accessReads > 1;
        return ok({
          subscribed,
          expiresAt: subscribed ? "2040-11-01T10:00:00Z" : null,
          cancelAtPeriodEnd: false,
          isOwner: false,
          monthlyPrice: "790",
        });
      }
      if (name === "club.claimPending") {
        state.claims++;
        return ok({ granted: false, orderId: null });
      }
      return ok(null);
    });
    return route.fulfill({
      json: url.searchParams.get("batch") === "1" ? values : values[0],
    });
  });
  await page.context().addCookies([
    {
      name: "session_fixture",
      value: "not-a-real-session",
      url: "http://localhost:8081",
    },
  ]);
  await page.route("**/api/prodamus/test/result", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers().cookie).toBeUndefined();
    expect(request.headers()["idempotency-key"]).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(request.postDataJSON()).toEqual({ token });
    state.reads++;
    await route.fulfill({ json: state.result });
  });
  return state;
}

for (const width of [320, 390, 1440])
  test(`a guest gets verified setup instructions, without being signed in at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await fixture(page);
    await gotoWithSession(page, returned);
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText("Оплата подтверждена");
    await expect(dialog(page)).toContainText("Письмо отправлено");
    await expect(dialog(page)).toContainText("установки пароля");
    await expect(page).toHaveURL(/\/club$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(dialog(page)).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: test.info().outputPath(`return-${width}.png`),
    });
    await expect(
      page.getByRole("button", { name: "Закрыть результат оплаты" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(
      page
        .getByRole("button", { name: "Открыть тестовую оплату", exact: true })
        .first(),
    ).toBeVisible();
    expect(state.reads).toBe(1);
  });

test("mail in the queue is not described as sent", async ({ page }) => {
  const state = await fixture(page);
  state.result = {
    state: "succeeded",
    nextAction: "setup",
    emailStatus: "pending",
  };
  await gotoWithSession(page, returned);
  await expect(dialog(page)).toContainText("Письмо готовится к отправке");
  await expect(dialog(page)).not.toContainText("Письмо отправлено");
});

test("unconfirmed payment is never congratulated or granted access", async ({
  page,
}) => {
  const state = await fixture(page);
  state.result = { state: "unknown", nextAction: null, emailStatus: null };
  await gotoWithSession(page, returned);
  await expect(dialog(page)).toContainText("Не удалось подтвердить");
  await expect(dialog(page)).not.toContainText("Оплата подтверждена");
  await expect(dialog(page)).not.toContainText("Письмо отправлено");
  expect(state.reads).toBe(1);
});

test("a signed-in paid member sees access without being sent to email", async ({
  page,
}) => {
  const state = await fixture(page, true);
  state.result = {
    state: "succeeded",
    nextAction: "login",
    emailStatus: "sent",
  };
  await gotoWithSession(page, returned);
  await expect(dialog(page)).toContainText("Доступ к клубу открыт");
  await expect(dialog(page)).not.toContainText("Письмо отправлено");
  await expect(dialog(page)).not.toContainText("установки пароля");
  expect(state.accessReads).toBeGreaterThanOrEqual(2);
  expect(state.claims).toBe(0);
});

test("old paid flags alone do not query the new result or show success", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/club?paid=1");
  await expect(
    page
      .getByRole("button", { name: "Открыть тестовую оплату", exact: true })
      .first(),
  ).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  expect(state.reads).toBe(0);
});

test("failed mail delivery does not promise an email or another charge", async ({
  page,
}) => {
  const state = await fixture(page);
  state.result = {
    state: "succeeded",
    nextAction: "setup",
    emailStatus: "unavailable",
  };
  await gotoWithSession(page, returned);
  await expect(dialog(page)).toContainText("Не удалось отправить письмо");
  await expect(dialog(page)).not.toContainText("Письмо отправлено");
  await expect(dialog(page)).toContainText("повторно платить не нужно");
});

test("closing while the result is delayed discards its late reply", async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route("**/api/prodamus/test/result", async (route) => {
    started = true;
    await held;
    await route
      .fulfill({
        json: { state: "succeeded", nextAction: "setup", emailStatus: "sent" },
      })
      .catch(() => {});
  });
  await gotoWithSession(page, returned);
  await expect(dialog(page)).toBeVisible();
  await expect.poll(() => started).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  release();
  await expect(
    page
      .getByRole("button", { name: "Открыть тестовую оплату", exact: true })
      .first(),
  ).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
});

test("rate limiting prevents an immediate new status request", async ({
  page,
}) => {
  await fixture(page);
  let reads = 0;
  await page.route("**/api/prodamus/test/result", async (route) => {
    reads++;
    await route.fulfill({
      status: 429,
      headers: { "Retry-After": "45" },
      json: { error: "private detail" },
    });
  });
  await gotoWithSession(page, returned);
  await expect(dialog(page)).toContainText("Слишком много запросов");
  await expect(
    dialog(page).getByRole("button", {
      name: "Проверить результат",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(dialog(page)).not.toContainText("private detail");
  expect(reads).toBe(1);
});

test("another signed-in account is not granted the receipt owner's access", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 102,
          openId: "other-member",
          name: "Другой пользователь",
          email: "other@example.test",
          role: "user",
          lastSignedIn: "2026-10-01T12:00:00Z",
        },
      },
    }),
  );
  await gotoWithSession(page, returned);
  await expect(dialog(page)).toContainText("Письмо отправлено");
  await expect(dialog(page)).not.toContainText("Доступ к клубу открыт");
  expect(state.accessReads).toBe(1);
  expect(state.claims).toBe(0);
});
