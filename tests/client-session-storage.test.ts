/** Проверяем cookie-only веб-сессию и удаление прежних персональных данных из localStorage. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import * as Auth from "../apps/frontend/src/domain/session/storage";
import { getMe } from "../apps/frontend/src/shared/api/auth";

const profile: Auth.User = {
  id: 1,
  openId: "PRIVATE_PROFILE",
  name: "Member",
  email: "private@example.test",
  phone: null,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  lastSignedIn: new Date(),
  role: "user",
};
let values: Map<string, string>;
let storage: {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};
/** Каждый сценарий получает собственный storage-recorder без данных предыдущего пользователя. */
beforeEach(() => {
  values = new Map();
  storage = {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key) => {
      values.delete(key);
    }),
  };
  vi.stubGlobal("window", { localStorage: storage });
  vi.clearAllMocks();
});
/** Возвращаем globals и spies после каждого сценария. */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Старый JS-доступный токен удаляется и не используется для авторизации. */
it("does not reuse a legacy browser token as a Bearer credential", async () => {
  values.set("app_session_token", "PRIVATE_SESSION");
  expect(await Auth.getSessionToken()).toBeNull();
  expect(values.has("app_session_token")).toBe(false);
});
/** Веб-клиент не записывает новый токен в storage; сессия принадлежит HttpOnly cookie. */
it("does not persist a newly issued browser token or invoke native storage", async () => {
  await Auth.setSessionToken("PRIVATE_SESSION");
  expect(values.has("app_session_token")).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
});
/** Профиль берётся из ответа сервера; следующий подтверждённый гость не подменяется старой копией. */
it("uses only the server profile and removes legacy personal data", async () => {
  values.set("daryadarcy-user-info", JSON.stringify(profile));
  const wireProfile = {
    ...profile,
    lastSignedIn: profile.lastSignedIn.toISOString(),
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ user: wireProfile }))
    .mockResolvedValueOnce(Response.json({ user: null }));
  vi.stubGlobal("fetch", fetcher);
  expect(await getMe()).toEqual(wireProfile);
  expect(values.has("daryadarcy-user-info")).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
  // A later guest response cannot fall back to a module-level profile copy.
  expect(await getMe()).toBeNull();
});
/** Отказ очистки storage не должен возвращать прежний токен или блокировать cookie-сессию. */
it("continues cookie-only web auth if local storage is unavailable", async () => {
  storage.removeItem.mockImplementation(() => {
    throw new Error("PRIVATE_STORAGE_ERROR");
  });
  await expect(
    Auth.setSessionToken("PRIVATE_SESSION"),
  ).resolves.toBeUndefined();
  expect(await Auth.getSessionToken()).toBeNull();
});
/** Персональный кеш и детали исключения storage не должны попадать в console. */
it("does not log cached personal data or storage exception contents", async () => {
  const logs = vi.spyOn(console, "log").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  values.set("daryadarcy-user-info", JSON.stringify(profile));
  await Auth.getSessionToken();
  storage.removeItem.mockImplementation(() => {
    throw new Error("PRIVATE_STORAGE_ERROR");
  });
  expect(await Auth.getSessionToken()).toBeNull();
  expect(
    JSON.stringify([...logs.mock.calls, ...errors.mock.calls]),
  ).not.toMatch(/PRIVATE_|private@example/);
});
