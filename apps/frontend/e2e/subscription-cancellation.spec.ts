import { expect, test, type Page } from "@playwright/test";
import { ok, failure } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test.skip(
  process.env.PRODAMUS_RETURN_UI_ENABLED === "true",
  "Live subscription cancellation is verified against a live-mode build.",
);

test.use({ hasTouch: true });
const expiration = "2040-11-01T10:00:00Z";
/** Выбираем мутацию отмены отдельно от read-only проверки её результата. */
const cancelButton = (page: Page) =>
  page.getByRole("button", { name: "Отменить подписку", exact: true });
/** Проверка отмены перечитывает подписку и не повторяет cancel-write. */
const checkButton = (page: Page) =>
  page.getByRole("button", { name: "Проверить отмену", exact: true });
/** Ограничиваем сообщения текущей subscription-карточкой профиля. */
const card = (page: Page) =>
  page.getByText("Подписка на клуб DARCY", { exact: true }).locator("../..");
/** Неизвестный исход сохраняется отдельным status, не объявляя автосписание выключенным. */
const unknownNotice = (page: Page) =>
  card(page)
    .getByRole("status")
    .filter({ hasText: "Отмена ещё не подтверждена" });
/** Независимо удерживаем cancel или subscription-read для проверки дедупликации и поздних ответов. */
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** Подписка, личность, cancel-ACK и fresh-read задаются отдельно: серверное pending и подтверждённый cancelAtPeriodEnd не выводятся только из HTTP200. */
async function fixture(page: Page) {
  await layoutApi(page, true);
  const state = {
    user: {
      id: 101,
      openId: "cancel-member",
      name: "Участница",
      email: "member@example.test",
      role: "user",
      lastSignedIn: "2026-10-01T12:00:00Z",
    } as {
      id: number;
      openId: string;
      name: string;
      email: string;
      role: string;
      lastSignedIn: string;
    } | null,
    subscription: {
      hasClubAccess: true,
      subscribed: true,
      expiresAt: expiration as string | null,
      cancelAtPeriodEnd: false,
      cancellationStatus: "none" as "none" | "pending" | "confirmed",
      isOwner: false,
      monthlyPrice: "790",
    },
    writes: 0,
    reads: 0,
    cancel: undefined as (() => unknown | Promise<unknown>) | undefined,
    read: undefined as (() => unknown | Promise<unknown>) | undefined,
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: state.user } }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    const results = await Promise.all(
      names.map(async (name) => {
        if (name === "club.cancel") {
          expect(route.request().method()).toBe("POST");
          state.writes++;
          if (state.cancel) return state.cancel();
          state.subscription.cancelAtPeriodEnd = true;
          return ok({
            ok: true,
            expiresAt: expiration,
            cancellationStatus: state.subscription.cancelAtPeriodEnd
              ? "confirmed"
              : "pending",
            message: "Запрос обработан",
          });
        }
        if (name === "club.subscription") {
          expect(route.request().method()).toBe("GET");
          state.reads++;
          return state.read
            ? state.read()
            : ok({
                ...state.subscription,
                cancellationStatus:
                  state.subscription.cancellationStatus === "pending"
                    ? "pending"
                    : state.subscription.cancelAtPeriodEnd
                      ? "confirmed"
                      : "none",
              });
        }
        if (name === "feed.interactionsForPosts")
          return ok({ likedIds: [], savedIds: [] });
        if (name === "feed.listPaginated" || name === "club.listByCategory")
          return ok({ posts: [], nextCursor: null });
        return ok([]);
      }),
    );
    await route
      .fulfill({
        json: url.searchParams.get("batch") === "1" ? results : results[0],
      })
      .catch(() => {});
  });
  return state;
}
/** Открываем подтверждённо активную fixture-подписку до изменения исхода cancel. */
async function open(page: Page) {
  await gotoWithSession(page, "/profile");
  await expect(card(page).getByText("Активна", { exact: true })).toBeVisible();
}
/** Подтверждаем действие настоящим confirm и нажимаем кнопку один раз. */
async function cancel(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await cancelButton(page).click();
}

/** Pending переживает reload даже при истёкшем/частично обновлённом доступе; дальнейшая проверка только читает. */
for (const kind of ["active", "expired", "partial"] as const) {
  test(`server pending state survives reload and uses read-only checks: ${kind}`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.subscription.cancellationStatus = "pending";
    if (kind === "expired") {
      state.subscription.hasClubAccess = false;
      state.subscription.subscribed = false;
      state.subscription.expiresAt = null;
    }
    if (kind === "partial") state.subscription.cancelAtPeriodEnd = true;
    await gotoWithSession(page, "/profile");
    await expect(card(page).getByRole("status")).toContainText(
      "Запрос на отмену сохранён",
    );
    await expect(
      card(page).getByText("Отменена, доступ сохранён", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(checkButton(page)).toBeVisible();
    const reads = state.reads;
    await checkButton(page).click();
    await expect.poll(() => state.reads).toBeGreaterThan(reads);
    expect(state.writes).toBe(0);
    if (kind === "expired")
      await expect(
        card(page).getByText("У тебя нет активной подписки", { exact: true }),
      ).toBeVisible();
    state.subscription.cancellationStatus = "confirmed";
    state.subscription.cancelAtPeriodEnd = true;
    await checkButton(page).click();
    await expect(checkButton(page)).toHaveCount(0);
    expect(state.writes).toBe(0);
  });
}

/** На трёх размерах отмена confirm не пишет, pending блокирует дубли, подтверждённое отключение сохраняет оплаченный период. */
for (const width of [320, 390, 1440]) {
  test(`confirmation, single write and preserved access at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await fixture(page);
    const held = deferred();
    state.cancel = async () => {
      await held.promise;
      state.subscription.cancelAtPeriodEnd = true;
      return ok({
        ok: true,
        expiresAt: expiration,
        cancellationStatus: state.subscription.cancelAtPeriodEnd
          ? "confirmed"
          : "pending",
        message: "Запрос обработан",
      });
    };
    await open(page);
    await cancelButton(page).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath(`active-${width}.png`),
    });
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("до конца оплаченного периода");
      await dialog.dismiss();
    });
    await cancelButton(page).tap();
    expect(state.writes).toBe(0);
    await cancelButton(page).focus();
    await expect(cancelButton(page)).toBeFocused();
    page.once("dialog", (dialog) => dialog.accept());
    await cancelButton(page).press("Enter");
    await expect(
      page.getByRole("button", { name: "Отменяем…", exact: true }),
    ).toBeDisabled();
    await expect(checkButton(page)).toBeDisabled();
    await page
      .getByRole("button", { name: "Отменяем…", exact: true })
      .dispatchEvent("click");
    expect(state.writes).toBe(1);
    const reads = state.reads;
    held.resolve();
    await expect(
      card(page).getByText("Отменена, доступ сохранён", { exact: true }),
    ).toBeVisible();
    await expect(
      card(page).getByText(
        "Автосписание отключено. Доступ до 1 ноября 2040 г.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(cancelButton(page)).toHaveCount(0);
    await expect(checkButton(page)).toHaveCount(0);
    await expect(
      page.getByText("member@example.test", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toBe(1);
    expect(state.reads).toBeGreaterThan(reads);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card(page).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath(`canceled-${width}.png`),
    });
  });
}

/** 400/500 после отправки считаются неизвестным исходом до свежего subscription-read, а не поводом слепо повторять cancel. */
for (const status of [400, 500]) {
  test(`HTTP ${status} keeps cancellation uncertain and only reads on retry`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.cancel = () => failure(status);
    await open(page);
    await cancel(page);
    await expect(unknownNotice(page)).toBeVisible();
    await expect(cancelButton(page)).toBeDisabled();
    const readsBeforeCheck = state.reads;
    await checkButton(page).click();
    await expect.poll(() => state.reads).toBeGreaterThan(readsBeforeCheck);
    await expect(checkButton(page)).toBeEnabled();
    await expect(unknownNotice(page)).toBeVisible();
    await expect(cancelButton(page)).toBeDisabled();
    expect(state.writes).toBe(1);
    state.subscription.cancelAtPeriodEnd = true;
    await checkButton(page).click();
    await expect(
      card(page).getByText("Отменена, доступ сохранён", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toBe(1);
    await expect(
      page.getByText(/PRIVATE_INTERNAL_DETAILS|Тестовая ошибка сохранения/),
    ).toHaveCount(0);
  });
}

test("transport failure can be checked without sending another cancellation", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.route("**/api/trpc/club.cancel?**", (route) => {
    state.writes++;
    return route.abort("failed");
  });
  await open(page);
  await cancel(page);
  await expect(unknownNotice(page)).toBeVisible();
  await expect(cancelButton(page)).toBeDisabled();
  state.subscription.cancelAtPeriodEnd = true;
  await checkButton(page).click();
  await expect(
    card(page).getByText("Отменена, доступ сохранён", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
});

/** Deadline не отменяет возможный серверный эффект и оставляет повтор write заблокированным до проверки. */
test("a timed-out cancellation blocks another write until status is checked", async ({
  page,
}) => {
  const state = await fixture(page);
  const held = deferred();
  state.cancel = async () => {
    await held.promise;
    return ok({
      ok: true,
      expiresAt: expiration,
      cancellationStatus: state.subscription.cancelAtPeriodEnd
        ? "confirmed"
        : "pending",
      message: "Запрос обработан",
    });
  };
  await open(page);
  await page.clock.install();
  await cancel(page);
  await expect(
    page.getByRole("button", { name: "Отменяем…", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => state.writes).toBe(1);
  await page.clock.fastForward(15_100);
  await expect(checkButton(page)).toBeEnabled();
  await expect(cancelButton(page)).toBeDisabled();
  state.subscription.cancelAtPeriodEnd = true;
  held.resolve();
  await checkButton(page).click();
  await expect(
    card(page).getByText("Отменена, доступ сохранён", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
});

/** Ожидающий status-read дедуплицируется и не превращается в отмену при повторном click. */
test("a pending status check cannot be duplicated or turn into another write", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const state = await fixture(page);
  state.cancel = () => failure(500);
  await open(page);
  await cancel(page);
  await expect(checkButton(page)).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("unknown-320.png") });
  const held = deferred();
  state.read = async () => {
    await held.promise;
    return ok({
      ...state.subscription,
      cancelAtPeriodEnd: true,
      cancellationStatus: "confirmed",
    });
  };
  const reads = state.reads;
  await checkButton(page).click();
  const checking = page.getByRole("button", {
    name: "Проверяем…",
    exact: true,
  });
  await expect(checking).toBeDisabled();
  await expect(cancelButton(page)).toBeDisabled();
  await checking.dispatchEvent("click");
  await expect.poll(() => state.reads).toBe(reads + 1);
  held.resolve();
  await expect(
    card(page).getByText("Отменена, доступ сохранён", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
});

test("unauthorized cancellation rechecks the session and hides private UI", async ({
  page,
}) => {
  const state = await fixture(page);
  state.cancel = () => {
    state.user = null;
    return failure(401);
  };
  await open(page);
  await cancel(page);
  await expect(
    page.getByText("Войдите, чтобы открыть личный кабинет", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("member@example.test", { exact: true }),
  ).toHaveCount(0);
  await expect(checkButton(page)).toHaveCount(0);
  expect(state.writes).toBe(1);
});

/** Неполный или некорректный cancel-response не подтверждает отключение автосписания. */
for (const result of [
  { ok: false, expiresAt: expiration },
  { ok: true, expiresAt: "invalid" },
  { ok: true },
]) {
  test(`malformed cancellation ${JSON.stringify(result)} cannot report success`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.cancel = () => ok(result);
    await open(page);
    await cancel(page);
    await expect(unknownNotice(page)).toBeVisible();
    await expect(
      card(page).getByText("Активна", { exact: true }),
    ).toBeVisible();
    await expect(cancelButton(page)).toBeDisabled();
    expect(state.writes).toBe(1);
  });
}

test("an ok response still needs confirmation from subscription", async ({
  page,
}) => {
  const state = await fixture(page);
  state.cancel = () =>
    ok({
      ok: true,
      expiresAt: expiration,
      cancellationStatus: state.subscription.cancelAtPeriodEnd
        ? "confirmed"
        : "pending",
      message: "Запрос обработан",
    });
  await open(page);
  const reads = state.reads;
  await cancel(page);
  await expect(checkButton(page)).toBeEnabled();
  await expect(unknownNotice(page)).toBeVisible();
  expect(state.reads).toBeGreaterThan(reads);
  await expect(cancelButton(page)).toBeDisabled();
  expect(state.writes).toBe(1);
});

/** Ошибочный fresh-read сохраняет прежний подтверждённый доступ, не снимая неизвестность отмены. */
for (const readResult of [
  failure(500),
  failure(429),
  ok({ subscribed: true, cancelAtPeriodEnd: true }),
  ok({
    hasClubAccess: true,
    subscribed: true,
    cancelAtPeriodEnd: true,
    expiresAt: "invalid",
    isOwner: false,
    monthlyPrice: "790",
  }),
]) {
  test(`failed or malformed fresh subscription ${JSON.stringify(readResult)} preserves access`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.cancel = () => {
      state.read = () => readResult;
      return ok({
        ok: true,
        expiresAt: expiration,
        cancellationStatus: state.subscription.cancelAtPeriodEnd
          ? "confirmed"
          : "pending",
        message: "Запрос обработан",
      });
    };
    await open(page);
    await cancel(page);
    await expect(checkButton(page)).toBeEnabled();
    await expect(cancelButton(page)).toBeDisabled();
    await expect(
      card(page).getByText("Активна", { exact: true }),
    ).toBeVisible();
    await checkButton(page).click();
    await expect(unknownNotice(page)).toContainText(
      "Не удалось проверить отмену",
    );
    await expect(
      page.getByText("member@example.test", { exact: true }),
    ).toBeVisible();
    state.read = undefined;
    state.subscription.cancelAtPeriodEnd = true;
    await checkButton(page).click();
    await expect(
      card(page).getByText("Отменена, доступ сохранён", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toBe(1);
  });
}

/** Известный rate-limit отказ разрешает только новое явное действие после сообщения. */
test("rate limiting allows an explicit retry after a known refusal", async ({
  page,
}) => {
  const state = await fixture(page);
  state.cancel = () => failure(429);
  await open(page);
  await cancel(page);
  await expect(card(page).getByRole("status")).toHaveText(
    "Слишком много запросов. Попробуйте позже.",
  );
  await expect(cancelButton(page)).toBeEnabled();
  state.cancel = undefined;
  await cancel(page);
  await expect(
    card(page).getByText("Отменена, доступ сохранён", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(2);
});

/** Уход прерывает continuation UI, но сохраняет неизвестный исход уже отправленного cancel. */
test("leaving the profile aborts verification and retains the uncertain write", async ({
  page,
}) => {
  const state = await fixture(page);
  const held = deferred();
  state.cancel = async () => {
    await held.promise;
    return ok({
      ok: true,
      expiresAt: expiration,
      cancellationStatus: state.subscription.cancelAtPeriodEnd
        ? "confirmed"
        : "pending",
      message: "Запрос обработан",
    });
  };
  await open(page);
  await cancel(page);
  await expect(
    page.getByRole("button", { name: "Отменяем…", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Лента", exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
  held.resolve();
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(unknownNotice(page)).toBeVisible();
  await expect(cancelButton(page)).toBeDisabled();
  state.subscription.cancelAtPeriodEnd = true;
  await checkButton(page).click();
  await expect(
    card(page).getByText("Отменена, доступ сохранён", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
});

/** Поздний ACK старого owner не меняет subscription-state нового аккаунта. */
test("a late response cannot change another account's subscription", async ({
  page,
}) => {
  const state = await fixture(page);
  const held = deferred();
  state.cancel = async () => {
    await held.promise;
    return ok({
      ok: true,
      expiresAt: expiration,
      cancellationStatus: state.subscription.cancelAtPeriodEnd
        ? "confirmed"
        : "pending",
      message: "Запрос обработан",
    });
  };
  await open(page);
  await cancel(page);
  await expect(
    page.getByRole("button", { name: "Отменяем…", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => state.writes).toBe(1);
  state.user = {
    ...state.user!,
    id: 102,
    openId: "other-member",
    email: "other@example.test",
  };
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "another-session",
      }),
    ),
  );
  await expect(
    page.getByText("other@example.test", { exact: true }),
  ).toBeVisible();
  held.resolve();
  await expect(cancelButton(page)).toBeEnabled();
  await expect(unknownNotice(page)).toHaveCount(0);
  await expect(card(page).getByText("Активна", { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
});

/** Фоновая подтверждённая отмена закрывает unknown-intent; следующий оплаченный период не наследует старую локальную блокировку. */
test("background confirmation clears uncertainty before a later subscription period", async ({
  page,
}) => {
  const state = await fixture(page);
  state.cancel = () => failure(500);
  await open(page);
  await cancel(page);
  await expect(checkButton(page)).toBeEnabled();
  /** Создаём реальный переход offline→online и дожидаемся subscription-response, не подменяя state провайдера напрямую. */
  const reconnect = async () => {
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("club.subscription"),
      ),
      page.evaluate(() => window.dispatchEvent(new Event("online"))),
    ]);
  };
  state.subscription.cancelAtPeriodEnd = true;
  await reconnect();
  await expect(
    card(page).getByText("Отменена, доступ сохранён", { exact: true }),
  ).toBeVisible();
  state.subscription = {
    ...state.subscription,
    cancelAtPeriodEnd: false,
    expiresAt: "2041-12-01T10:00:00Z",
  };
  await reconnect();
  await expect(cancelButton(page)).toBeEnabled();
  await expect(unknownNotice(page)).toHaveCount(0);
  expect(state.writes).toBe(1);
});

/** Подтверждённо истёкший период не продлевается локально, даже если cancel-ACK успешен. */
test("confirmed expiration closes private access without extending its period", async ({
  page,
}) => {
  const state = await fixture(page);
  state.cancel = () => {
    state.subscription = {
      ...state.subscription,
      hasClubAccess: false,
      subscribed: false,
      expiresAt: "2000-01-01T00:00:00Z",
      cancelAtPeriodEnd: true,
    };
    return ok({
      ok: true,
      expiresAt: "2000-01-01T00:00:00Z",
      cancellationStatus: "confirmed",
      message: "Отмена подтверждена",
    });
  };
  await open(page);
  await cancel(page);
  await expect(
    page.getByText("У тебя нет активной подписки", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("member@example.test", { exact: true }),
  ).toBeVisible();
  await expect(cancelButton(page)).toHaveCount(0);
  expect(state.writes).toBe(1);
});

/** Владелице, уже отменённой/неактивной подписке и гостю не предлагаются неподходящие cancellation-actions. */
for (const kind of ["owner", "canceled", "inactive", "guest"]) {
  test(`cancellation is unavailable for ${kind}`, async ({ page }) => {
    const state = await fixture(page);
    if (kind === "owner") {
      state.user!.role = "admin";
      state.subscription.isOwner = true;
    }
    if (kind === "canceled") state.subscription.cancelAtPeriodEnd = true;
    if (kind === "inactive") {
      state.subscription.hasClubAccess = false;
      state.subscription.subscribed = false;
    }
    if (kind === "guest") state.user = null;
    await gotoWithSession(page, "/profile");
    const expected =
      kind === "owner"
        ? "Профиль владелицы клуба."
        : kind === "canceled"
          ? "Отменена, доступ сохранён"
          : kind === "inactive"
            ? "У тебя нет активной подписки"
            : "Войдите, чтобы открыть личный кабинет";
    await expect(page.getByText(expected, { exact: false })).toBeVisible();
    await expect(cancelButton(page)).toHaveCount(0);
    await expect(checkButton(page)).toHaveCount(0);
    expect(state.writes).toBe(0);
  });
}
