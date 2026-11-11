import { expect, test, type Page } from "@playwright/test";
import { editorApi } from "./editor-fixtures";

/** Создаём различимые аккаунты, чтобы смена личности была видна независимо от публичных возможностей. */
const member = (id: number) => ({
  id,
  openId: `capabilities-member-${id}`,
  name: `Member ${id}`,
  email: `member-${id}@example.test`,
  phone: null,
  gender: "female",
  role: "user",
  lastSignedIn: "2026-10-26T10:00:00Z",
});
const capabilities = {
  smsLogin: true,
  penPals: false,
  shopOnlinePayment: false,
  webPush: false,
  privateContentUploads: true,
  privatePostMediaUploads: true,
  privatePostVideoUploads: true,
};
/** Даём тесту независимо отпускать ответы сессии и capabilities и проверять запоздавший результат. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
/** Снимок ответа делаем до ожидания gate: поздний ответ действительно несёт старые возможности, а не новое состояние fixture. */
async function fixture(page: Page) {
  await editorApi(page);
  const state = {
    user: member(101) as ReturnType<typeof member> | null,
    capabilities: { ...capabilities },
    status: 0,
    meReads: 0,
    capReads: 0,
    capReplies: 0,
    authGate: undefined as Promise<void> | undefined,
    capGate: undefined as Promise<void> | undefined,
  };
  await page.route("**/api/auth/me", async (route) => {
    state.meReads++;
    const user = state.user;
    if (state.authGate) await state.authGate;
    await route.fulfill({ json: { user } }).catch(() => {});
  });
  await page.route("**/api/capabilities", async (route) => {
    state.capReads++;
    const json = { ...state.capabilities };
    const status = state.status;
    if (state.capGate) await state.capGate;
    await route.fulfill({ status: status || 200, json }).catch(() => {});
    state.capReplies++;
  });
  return state;
}
/** Отдельно выбираем предложение SMS-привязки, которое политика клиента не должна включать по одному серверному флагу. */
const phoneOffer = (page: Page) =>
  page.getByText("Привяжите телефон, чтобы входить по SMS", { exact: true });
/** Сначала завершаем публичный read при ожидающей сессии, затем подтверждаем личность; проверяем перенос свежести без повторного чтения. */
async function startWithCompletedCapabilities(
  page: Page,
  state: Awaited<ReturnType<typeof fixture>>,
) {
  const gate = deferred();
  state.authGate = gate.promise;
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    // SMS stays disabled by frontend policy even when the server advertises it.
    // Let the completed public read reach the cache before confirming identity.
    await expect.poll(() => state.capReplies).toBe(1);
    await page.clock.runFor(200);
    await expect(
      page.getByRole("button", { name: "Войти по телефону", exact: true }),
    ).toHaveCount(0);
    expect(state.capReads).toBe(1);
  } finally {
    state.authGate = undefined;
    gate.resolve();
  }
  if (state.user) {
    await page
      .getByRole("link", { name: "Открыть профиль", exact: true })
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByText(state.user.email, { exact: true }),
    ).toBeVisible();
    await expect(phoneOffer(page)).toHaveCount(0);
  }
  await page.clock.runFor(200);
}
/** Эмулируем событие возврата/сети и даём запланированному обновлению завершить короткую задержку. */
async function resume(page: Page, event = "visibilitychange") {
  await page.evaluate((event) => {
    if (event === "visibilitychange")
      document.dispatchEvent(new Event(event, { bubbles: true }));
    else window.dispatchEvent(new Event(event));
  }, event);
  await page.clock.runFor(200);
}

test("capabilities: confirming the initial member does not repeat a completed public read", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  await startWithCompletedCapabilities(page, state);
  expect(state.meReads).toBe(1);
  expect(state.capReads).toBe(1);
});

test("capabilities: the guest keeps the same completed public read", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  state.user = null;
  await startWithCompletedCapabilities(page, state);
  expect(state.capReads).toBe(1);
  await expect(
    page.getByRole("button", { name: "Войти по телефону", exact: true }),
  ).toHaveCount(0);
});

/** Смена аккаунта не продлевает исходный TTL публичного кеша: после оставшихся 16 секунд требуется новый read. */
test("capabilities: switching accounts preserves public freshness without extending its lifetime", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  await startWithCompletedCapabilities(page, state);
  await page.clock.fastForward(45_000);
  state.user = member(202);
  await resume(page, "online");
  await expect(page.getByText(state.user.email, { exact: true })).toBeVisible();
  await expect(
    page.getByText("member-101@example.test", { exact: true }),
  ).toHaveCount(0);
  expect(state.capReads).toBe(1);
  state.capabilities.smsLogin = false;
  await page.clock.fastForward(16_000);
  await resume(page);
  await expect.poll(() => state.capReads).toBe(2);
  await expect(phoneOffer(page)).toHaveCount(0);
});

test("capabilities: stale public data is rechecked on network recovery", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  await startWithCompletedCapabilities(page, state);
  state.capabilities.smsLogin = false;
  await resume(page, "offline");
  await page.clock.fastForward(61_000);
  expect(state.capReads).toBe(1);
  await resume(page, "online");
  await expect.poll(() => state.capReads).toBe(2);
  await expect(phoneOffer(page)).toHaveCount(0);
});

test("capabilities: an error with previously cached data is not restored as success for another account", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  await startWithCompletedCapabilities(page, state);
  state.status = 500;
  await page.clock.fastForward(61_000);
  await resume(page);
  await expect.poll(() => state.capReads).toBe(2);
  await expect(phoneOffer(page)).toHaveCount(0);
  state.user = member(202);
  await resume(page, "online");
  await expect(page.getByText(state.user.email, { exact: true })).toBeVisible();
  await expect.poll(() => state.capReads).toBe(3);
  await expect(phoneOffer(page)).toHaveCount(0);
});

/** Подтверждение личности отменяет незавершённый read; ответ старого поколения не должен вернуть устаревшее состояние. */
test("capabilities: identity confirmation cancels an unfinished read and ignores its late response", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  const auth = deferred();
  const oldCapabilities = deferred();
  state.authGate = auth.promise;
  state.capGate = oldCapabilities.promise;
  try {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect.poll(() => state.meReads).toBe(1);
    await expect.poll(() => state.capReads).toBe(1);
    state.capGate = undefined;
    state.authGate = undefined;
    state.capabilities.smsLogin = false;
    auth.resolve();
    await expect(
      page.getByText(state.user!.email, { exact: true }),
    ).toBeVisible();
    await expect.poll(() => state.capReads).toBe(2);
    await expect.poll(() => state.capReplies).toBe(1);
    oldCapabilities.resolve();
    await expect.poll(() => state.capReplies).toBe(2);
    await page.clock.runFor(200);
    await expect(phoneOffer(page)).toHaveCount(0);
    expect(state.capReads).toBe(2);
  } finally {
    auth.resolve();
    oldCapabilities.resolve();
  }
});
