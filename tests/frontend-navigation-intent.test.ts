/** Навигационные intents проверяются synthetic window/history/sessionStorage, включая возврат к UUID-посту после входа. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let navigation: typeof import("../apps/frontend/src/shared/navigation/navigation-intent");
/** Изолированная вкладка хранит собственный URL/history/state и отдельный Map sessionStorage. */
function browser(path = "/login", storage = new Map<string, string>()) {
  let location = new URL(path, "https://app.example.test");
  let state: Record<string, unknown> = { __darcyEntryIndex: 2, __NA: true };
  const history = {
    get state() {
      return state;
    },
    replaceState: vi.fn(
      (next: Record<string, unknown>, _title: string, url?: string) => {
        state = next;
        if (url) location = new URL(url, location);
      },
    ),
  };
  return {
    get location() {
      return location;
    },
    history,
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
    dispatchEvent: vi.fn(),
    storage,
  };
}
/** Чистый module-cache сбрасывает in-memory fallback и создаёт новое login-окно. */
beforeEach(async () => {
  vi.resetModules();
  navigation =
    await import("../apps/frontend/src/shared/navigation/navigation-intent");
  vi.stubGlobal("window", browser());
});
/** Возвращаем globals/Date spies. */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Внешние, неизвестные, normalized traversal и login-loop paths не сохраняются. */
it.each([
  "https://other.test/admin",
  "//other.test/admin",
  "/\\other.test",
  "/admin/../profile",
  "/unknown",
  "/login",
  "/oauth/callback",
  "/post/0",
  "/post/9007199254740992",
  "/post/c22db58f-698b-41ea-8e12-524d8323b03g",
  "/post/c22db58f-698b-11ea-8e12-524d8323b034",
  "/post/c22db58f-698b-41ea-7e12-524d8323b034",
  "/post/c22db58f-698b-41ea-8e12-524d8323b034/extra",
  "/post/c22db58f-698b-41ea-8e12-524d8323b034/../123",
  "/post/%632db58f-698b-41ea-8e12-524d8323b034",
  "/video/c22db58f-698b-41ea-8e12-524d8323b034",
  "/admin\n",
])("rejects unsafe, unknown or looping return destination %s", (path) => {
  expect(navigation.loginDestination(path)).toBeNull();
});
/** Из разрешённого пути удаляются query/hash; UUID v4 допустим только для поста. */
it.each([
  "/admin",
  "/profile",
  "/post/123",
  "/post/c22db58f-698b-41ea-8e12-524d8323b034",
  "/post/C22DB58F-698B-41EA-8E12-524D8323B034",
  "/video/5",
  "/library/article/9",
  "/shop/digital-1",
  "/legal/offer",
])("keeps a supported destination %s without carrying secrets", (path) => {
  expect(
    navigation.loginDestination(path + "?token=private&order=private#secret"),
  ).toEqual({ pathname: path });
});
/** Сохраняются два boolean hints, не order/token и не доказательство оплаты. */
it("keeps only the recognized club flags from an old encoded return link", () => {
  expect(
    navigation.loginDestination(
      "/club?paid=1&checkout=1&token=secret&order=private",
    ),
  ).toEqual({
    pathname: "/club",
    club: { checkout: true, paymentReturn: true },
  });
});
/** Intent переживает reload своей вкладки и после consume возвращается к profile fallback. */
it("captures an old login link, retains the return across reload, and consumes it once", () => {
  const tab = browser("/login?next=/admin&token=private#secret");
  vi.stubGlobal("window", tab);
  navigation.prepareLoginPage("/admin");
  expect(tab.location.href).toBe("https://app.example.test/login");
  expect(tab.history.state).toMatchObject({ __darcyEntryIndex: 2, __NA: true });
  vi.stubGlobal("window", browser("/login", tab.storage));
  navigation.prepareLoginPage();
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/admin" });
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/profile" });
});
/** Гостевые действия сохраняют адрес поста перед входом; перезагрузка не теряет intent и не переносит секреты. */
it.each(["/post/123", "/post/c22db58f-698b-41ea-8e12-524d8323b034"])(
  "retains %s across a login reload and consumes it once",
  async (path) => {
    const tab = browser("/login?token=private#secret");
    vi.stubGlobal("window", tab);
    navigation.rememberLoginReturn(path + "?token=private#secret");
    navigation.prepareLoginPage();
    expect(tab.location.href).toBe("https://app.example.test/login");
    expect(tab.history.state).toMatchObject({ __darcyEntryIndex: 2, __NA: true });
    vi.stubGlobal("window", browser("/login", tab.storage));
    vi.resetModules();
    navigation =
      await import("../apps/frontend/src/shared/navigation/navigation-intent");
    navigation.prepareLoginPage();
    expect(navigation.consumeLoginReturn()).toEqual({ pathname: path });
    expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/profile" });
  },
);
/** Новый недопустимый next очищает прежнее назначение. */
it("does not reuse a previous return when an invalid legacy destination is supplied", () => {
  navigation.rememberLoginReturn("/admin");
  navigation.prepareLoginPage();
  navigation.prepareLoginPage("//other.test");
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/profile" });
});
/** History fallback не продлевает30минутный TTL. */
it("expires a pending return even when it was also retained in history", () => {
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now);
  navigation.rememberLoginReturn("/admin");
  navigation.prepareLoginPage();
  vi.spyOn(Date, "now").mockReturnValue(now + 31 * 60_000);
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/profile" });
});
/** Разные sessionStorage вкладок не подменяют друг друга. */
it("keeps return destinations separate between tabs", () => {
  const first = browser();
  const second = browser();
  vi.stubGlobal("window", first);
  navigation.rememberLoginReturn("/admin");
  vi.stubGlobal("window", second);
  navigation.rememberLoginReturn("/post/123");
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/post/123" });
  vi.stubGlobal("window", first);
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/admin" });
});
/** History/in-memory fallback сохраняет единичный возврат при blocked storage. */
it("preserves the current transition and reload history when storage is unavailable", async () => {
  const tab = browser();
  for (const method of ["getItem", "setItem", "removeItem"] as const)
    vi.spyOn(tab.sessionStorage, method).mockImplementation(() => {
      throw new Error("Storage blocked");
    });
  vi.stubGlobal("window", tab);
  navigation.rememberLoginReturn("/post/123");
  navigation.prepareLoginPage();
  vi.resetModules();
  navigation =
    await import("../apps/frontend/src/shared/navigation/navigation-intent");
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/post/123" });
  expect(navigation.consumeLoginReturn()).toEqual({ pathname: "/profile" });
});
/** Paid hint переносится в безопасное state, секреты удаляются из URL/history. */
it("cleans a payment return without losing its hint or persisting order/token values", () => {
  const tab = browser(
    "/club?paid=1&order=private&payment=returned&token=private#token=private",
  );
  vi.stubGlobal("window", tab);
  const captured = navigation.captureClubNavigation();
  expect(captured).toMatchObject({ checkout: false, paymentReturn: true });
  expect(tab.location.href).toBe("https://app.example.test/club");
  expect(JSON.stringify(tab.history.state)).not.toContain("private");
  expect(navigation.captureClubNavigation()).toEqual(captured);
});

/** Первое explicit false значение очищает прежний checkout hint, дубликатtrue не побеждает. */
it("explicit false flags replace a prior renewal hint", () => {
  const tab = browser("/club?checkout=1");
  vi.stubGlobal("window", tab);
  expect(navigation.captureClubNavigation()?.checkout).toBe(true);
  tab.history.replaceState(
    tab.history.state,
    "",
    "/club?checkout=0&checkout=1",
  );
  expect(navigation.captureClubNavigation()).toBeNull();
  expect(tab.location.search).toBe("");
});
/** Renewal intent потребляется своим маршрутом и не переносится через посторонние страницы. */
it("hands renewal to a clean club page and removes hints from unrelated entries", () => {
  const tab = browser("/profile");
  vi.stubGlobal("window", tab);
  navigation.rememberClubNavigation({ checkout: true, paymentReturn: false });
  tab.history.replaceState(tab.history.state, "", "/club");
  expect(navigation.captureClubNavigation()).toMatchObject({
    checkout: true,
    paymentReturn: false,
  });
  tab.history.replaceState(tab.history.state, "", "/feed");
  navigation.clearOtherPageIntents();
  tab.history.replaceState(tab.history.state, "", "/club");
  expect(navigation.captureClubNavigation()).toBeNull();
  expect(tab.history.state).toMatchObject({ __darcyEntryIndex: 2, __NA: true });
});

/** Общий cleanup оставляет обычный description anchor без order/token. */
it("removes unused payment and secret parameters from product pages while preserving normal anchors", () => {
  const tab = browser(
    "/shop/digital-1?paid=1&order=private&token=secret#description",
  );
  vi.stubGlobal("window", tab);
  navigation.clearOtherPageIntents();
  expect(tab.location.href).toBe(
    "https://app.example.test/shop/digital-1#description",
  );
  expect(JSON.stringify(tab.history.state)).not.toMatch(/private|secret/);
});

/** Owner экран получает возможность забрать hint до общей очистки. */
it("does not clear a login or club query before its owning screen captures it", () => {
  const tab = browser("/club?paid=1");
  vi.stubGlobal("window", tab);
  navigation.clearOtherPageIntents();
  expect(tab.location.search).toBe("?paid=1");
  tab.history.replaceState(tab.history.state, "", "/login?next=/admin");
  navigation.clearOtherPageIntents();
  expect(tab.location.search).toBe("?next=/admin");
});
