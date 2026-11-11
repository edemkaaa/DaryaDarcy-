import { expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { QueryClient } from "@tanstack/react-query";
import { SessionController } from "../apps/frontend/src/domain/session/session-controller";
import {
  ApiError,
  parseAuthUser,
  type AuthUser,
} from "../apps/frontend/src/shared/api/auth";

const member = (id: number): AuthUser => /* Строит минимального синтетического пользователя для проверки переходов личности и ревизии. */ ({
  id,
  openId: `member-${id}`,
  name: `Member ${id}`,
  email: `member-${id}@example.test`,
  phone: null,
  gender: null,
  avatarUrl: null,
  loginMethod: "email",
  role: "user",
  lastSignedIn: "2026-10-04T10:00:00Z",
});
function deferred<T>() {
  // Даёт управляемый Promise, чтобы завершать старый HTTP-ответ строго после нужного перехода сессии.

  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
// Контроллер проверяется отдельно от React: управляемые Promise и локальный HTTP позволяют доказать порядок смены личности даже когда транспорт игнорирует отмену.
function fixture(
  getMe = vi.fn(async () => null as AuthUser | null),
  logout = vi.fn(async () => {}),
) {
  // Создаёт контроллер с QueryClient и наблюдаемыми сбросом кеша, broadcast и маркером незавершённого выхода.

  const cache = new QueryClient();
  const resetIdentity = vi.fn(() => {
    void cache.cancelQueries();
    cache.clear();
  });
  const broadcast = vi.fn();
  const setLogoutPending = vi.fn();
  return {
    controller: new SessionController({
      getMe,
      logout,
      resetIdentity,
      broadcast,
      setLogoutPending,
    }),
    cache,
    resetIdentity,
    broadcast,
    setLogoutPending,
  };
}

it("a late guest response cannot overwrite a successful sign-in", async () => {
  // Сценарий: Поздний guest-ответ не перезаписывает успешный вход.

  const old = deferred<AuthUser | null>();
  const f = fixture(vi.fn(() => old.promise));
  const refresh = f.controller.refresh();
  expect(
    await f.controller.authenticate(async () => ({ user: member(2) })),
  ).toBe(true);
  old.resolve(null);
  await refresh;
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    user: { id: 2 },
  });
});

it.each([200, 401])(
  "a late loopback session response (%s) cannot replace the new account or its private cache",
  async (status) => {
    // Сценарий: Поздний локальный HTTP 200/401 прежней сессии не заменяет новый аккаунт и его приватный кеш.

    const entered = deferred<void>();
    const release = deferred<void>();
    const server = createServer(async (_request, response) => {
      entered.resolve();
      await release.promise;
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ user: member(1) }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let oldSignal: AbortSignal | undefined;
    const getMe = vi.fn(async (signal?: AbortSignal) => {
      oldSignal = signal;
      // Deliberately let the native HTTP response complete despite cancellation.
      // This tests the operation guard, not the browser fetch abort implementation.
      const response = await fetch(origin + "/api/auth/me");
      if (!response.ok)
        throw new ApiError("old session denied", response.status);
      return parseAuthUser((await response.json()).user);
    });
    const f = fixture(getMe);
    let pending: Promise<void> | undefined;
    try {
      await f.controller.applySession(member(1));
      f.cache.setQueryData(["savedPosts"], ["PRIVATE_MEMBER_1"]);
      pending = f.controller.refresh();
      await entered.promise;
      await f.controller.applySession(member(2));
      expect(oldSignal?.aborted).toBe(true);
      expect(f.cache.getQueryData(["savedPosts"])).toBeUndefined();
      f.cache.setQueryData(["savedPosts"], ["PRIVATE_MEMBER_2"]);
      const newSession = f.controller.getSnapshot();
      f.resetIdentity.mockClear();
      release.resolve();
      await pending;
      expect(f.controller.getSnapshot()).toBe(newSession);
      expect(newSession).toMatchObject({
        status: "authenticated",
        user: { id: 2 },
        error: null,
        refreshError: null,
      });
      expect(f.cache.getQueryData(["savedPosts"])).toEqual([
        "PRIVATE_MEMBER_2",
      ]);
      expect(f.resetIdentity).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      await pending;
      f.controller.dispose();
      f.cache.clear();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);

it("an older HTTP refresh cannot clear the in-flight marker of a newer forced refresh", async () => {
  // Сценарий: Старый refresh не очищает in-flight маркер более нового принудительного refresh.

  const entered = [deferred<void>(), deferred<void>()];
  const release = [deferred<void>(), deferred<void>()];
  let requests = 0;
  const server = createServer(async (_request, response) => {
    const index = requests++;
    entered[index]?.resolve();
    if (release[index]) await release[index].promise;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ user: member(index + 1) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Allow both wire responses to complete; operation ordering must stand on its own.
  const getMe = vi.fn(async () =>
    parseAuthUser((await (await fetch(origin + "/api/auth/me")).json()).user),
  );
  const f = fixture(getMe);
  const pending: Promise<void>[] = [];
  try {
    await f.controller.applySession(member(1));
    const original = f.controller.getSnapshot();
    pending.push(f.controller.refresh());
    await entered[0].promise;
    pending.push(f.controller.refresh(true));
    await entered[1].promise;
    release[0].resolve();
    await pending[0];
    expect(f.controller.getSnapshot()).toBe(original);
    // A resume event while the newer response is held must not create a third request.
    pending.push(f.controller.refresh());
    await pending[2];
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(requests).toBe(2);
    release[1].resolve();
    await pending[1];
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "authenticated",
      user: { id: 2 },
      scope: original.scope + 1,
    });
  } finally {
    for (const barrier of release) barrier.resolve();
    await Promise.all(pending);
    f.controller.dispose();
    f.cache.clear();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

it("switching accounts removes private queries and resets the screen scope", async () => {
  // Сценарий: Смена аккаунта удаляет приватные queries и меняет область экранов.

  const f = fixture();
  await f.controller.applySession(member(1));
  f.cache.setQueryData(["savedPosts"], ["private member 1"]);
  const oldScope = f.controller.getSnapshot().scope;
  await f.controller.applySession(member(2));
  expect(f.cache.getQueryData(["savedPosts"])).toBeUndefined();
  expect(f.controller.getSnapshot().scope).toBeGreaterThan(oldScope);
  expect(f.resetIdentity).toHaveBeenLastCalledWith(2);
});

it("login completion does not wait for unrelated query refetches", async () => {
  // Сценарий: Вход завершается без ожидания посторонних refetch.

  const f = fixture();
  const never = deferred<string>();
  const oldQuery = f.cache
    .fetchQuery({ queryKey: ["slow"], queryFn: () => /* Оставляет посторонний запрос незавершённым, проверяя, что вход не ждёт его refetch. */ never.promise })
    .catch(() => undefined);
  await f.controller.applySession(member(1));
  expect(f.controller.getSnapshot().status).toBe("authenticated");
  never.resolve("old");
  await oldQuery;
  expect(f.cache.getQueryData(["slow"])).toBeUndefined();
});

it("initial network failure is a recoverable error, not a confirmed guest", async () => {
  // Сценарий: Первоначальный сетевой отказ остаётся восстанавливаемой ошибкой, а не подтверждённым гостем.

  const getMe = vi.fn(async () => {
    throw new ApiError("Нет сети", 0, undefined, false, "network");
  });
  const f = fixture(getMe);
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "error",
    user: null,
  });
});

it.each([
  new ApiError("offline", 0, undefined, false, "network"),
  new ApiError("unavailable", 503),
  new ApiError("invalid", 0, undefined, false, "invalid-response"),
])(
  "failed initial session checks preserve public queries: %s",
  async (error) => {
    // Сценарий: Неудачная первоначальная проверка сохраняет публичные данные до установления личности.

    const getMe = vi
      .fn<() => Promise<AuthUser | null>>()
      .mockRejectedValue(error);
    const f = fixture(getMe);
    const startup = f.controller.refresh();
    // Public screens load independently while auth/me is still pending.
    f.cache.setQueryData(["feed"], ["PUBLIC_POST"]);
    await startup;
    await f.controller.refresh();
    const screen = f.controller.getSnapshot();
    const retry = deferred<AuthUser | null>();
    getMe.mockReturnValueOnce(retry.promise);
    const pending = f.controller.refresh();
    expect(f.controller.getSnapshot()).toBe(screen);
    expect(screen.status).toBe("error");
    expect(f.cache.getQueryData(["feed"])).toEqual(["PUBLIC_POST"]);
    retry.resolve(null);
    await pending;
    expect(f.controller.getSnapshot().status).toBe("guest");
    expect(f.cache.getQueryData(["feed"])).toEqual(["PUBLIC_POST"]);
    expect(f.resetIdentity).not.toHaveBeenCalled();
  },
);

it("repeated initial errors keep public data until a real identity is established", async () => {
  // Сценарий: Повторные стартовые ошибки не сбрасывают публичный кеш; реальный вход создаёт новую область.

  const getMe = vi
    .fn<() => Promise<AuthUser | null>>()
    .mockRejectedValue(new ApiError("unavailable", 503));
  const f = fixture(getMe);
  f.cache.setQueryData(["public"], "PUBLIC_DATA");
  for (let attempt = 0; attempt < 3; attempt++) {
    await f.controller.refresh();
    expect(f.controller.getSnapshot().status).toBe("error");
    expect(f.cache.getQueryData(["public"])).toBe("PUBLIC_DATA");
  }
  expect(f.resetIdentity).not.toHaveBeenCalled();
  getMe.mockResolvedValue(member(1));
  await f.controller.refresh();
  expect(f.controller.getSnapshot().status).toBe("authenticated");
  expect(f.cache.getQueryData(["public"])).toBeUndefined();
  expect(f.resetIdentity).toHaveBeenCalledExactlyOnceWith(1);
});

it("logout closes local access immediately and preserves an unconfirmed logout for retry", async () => {
  // Сценарий: Выход сразу закрывает локальный доступ, сохраняя маркер до подтверждения сервера.

  const request = deferred<void>();
  const f = fixture(
    undefined,
    vi.fn(() => request.promise),
  );
  await f.controller.applySession(member(1));
  const pending = f.controller.logout();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "logging-out",
    user: null,
  });
  expect(f.setLogoutPending).toHaveBeenLastCalledWith(true);
  request.resolve();
  await pending;
  expect(f.controller.getSnapshot().status).toBe("guest");
  expect(f.setLogoutPending).toHaveBeenLastCalledWith(false);
});

it("failed logout cannot silently resurrect the account or accept another login", async () => {
  // Сценарий: Неудачный выход не восстанавливает старую личность и блокирует новый вход до подтверждения выхода.

  const f = fixture(
    undefined,
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  await f.controller.applySession(member(1));
  await f.controller.logout();
  await f.controller.refresh();
  expect(f.controller.getSnapshot().status).toBe("logout-error");
  await expect(
    f.controller.authenticate(async () => ({ user: member(2) })),
  ).rejects.toThrow("подтвердите выход");
});

it("an old login response cannot reopen access after logout", async () => {
  // Сценарий: Старый login-ответ не открывает доступ после logout.

  const f = fixture();
  const login = deferred<{ user: AuthUser }>();
  const pending = f.controller.authenticate(() => login.promise);
  await f.controller.logout();
  login.resolve({ user: member(1) });
  expect(await pending).toBe(false);
  expect(f.controller.getSnapshot().status).toBe("guest");
});

it("initial refresh can restart after Strict Mode cleanup", async () => {
  // Сценарий: Первоначальная проверка может возобновиться после StrictMode cleanup.

  const old = deferred<AuthUser | null>();
  const getMe = vi.fn(() => old.promise).mockResolvedValueOnce(member(1));
  const f = fixture(getMe);
  const first = f.controller.refresh();
  f.controller.dispose();
  const second = f.controller.refresh();
  old.resolve(member(2));
  await Promise.all([first, second]);
  expect(f.controller.getSnapshot().user?.id).toBe(2);
});

it("a pending logout restarts after Strict Mode cleanup without restoring access", async () => {
  // Сценарий: Незавершённый выход перезапускается после cleanup без восстановления доступа.

  const interrupted = deferred<void>();
  const logout = vi.fn(async (): Promise<void> => {
    throw new Error("offline");
  });
  logout.mockImplementationOnce(() => interrupted.promise);
  const f = fixture(undefined, logout);
  await f.controller.applySession(member(1));
  const first = f.controller.logout();
  await f.controller.logout();
  expect(logout).toHaveBeenCalledTimes(1);
  f.controller.dispose();
  expect(f.controller.getSnapshot().user).toBeNull();
  await f.controller.logout();
  expect(logout).toHaveBeenCalledTimes(2);
  expect(f.controller.getSnapshot().status).toBe("logout-error");
  interrupted.resolve();
  await first;
  expect(f.controller.getSnapshot().status).toBe("logout-error");
  expect(f.controller.getSnapshot().user).toBeNull();
});

it("a 403 permission failure does not discard a valid identity or cause query refetch loops", async () => {
  // Сценарий: Отказ права 403 не удаляет действительную личность и не создаёт refetch-цикл.

  const f = fixture(vi.fn(async () => member(1)));
  await f.controller.applySession(member(1));
  const scope = f.controller.getSnapshot().scope;
  f.controller.verifyAfterAccessError(403);
  await Promise.resolve();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    scope,
  });
});

it("a 401 closes private data before the session recheck completes", async () => {
  // Сценарий: 401 закрывает приватные данные до завершения проверки сессии.

  const check = deferred<AuthUser | null>();
  const f = fixture(vi.fn(() => check.promise));
  await f.controller.applySession(member(1));
  f.cache.setQueryData(["private"], "PRIVATE");
  f.controller.verifyAfterAccessError(401);
  expect(f.controller.getSnapshot().user).toBeNull();
  expect(f.cache.getQueryData(["private"])).toBeUndefined();
  check.resolve(null);
  await Promise.resolve();
});

it("another tab can confirm a previously failed logout", async () => {
  // Сценарий: Другая вкладка может подтвердить ранее неудачный выход.

  const f = fixture(
    undefined,
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  await f.controller.applySession(member(1));
  await f.controller.logout();
  f.controller.completeExternalLogout();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "guest",
    error: null,
    user: null,
  });
});

it("a temporary session check failure preserves the screen scope for the same person", async () => {
  // Сценарий: Временный сбой проверки того же человека сохраняет область экрана.

  const getMe = vi.fn(async () => member(1));
  const f = fixture(getMe);
  await f.controller.applySession(member(1));
  const scope = f.controller.getSnapshot().scope;
  getMe.mockRejectedValueOnce(
    new ApiError("offline", 0, undefined, false, "network"),
  );
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    user: { id: 1 },
    error: null,
    refreshError: expect.any(Error),
    scope,
  });
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    refreshError: null,
    scope,
  });
  await f.controller.applySession(member(2));
  expect(f.controller.getSnapshot().scope).toBeGreaterThan(scope);
});

it("a confirmed guest stays visible throughout a pending background check", async () => {
  // Сценарий: Подтверждённый гость остаётся видимым во время фоновой проверки без нового loading.

  const check = deferred<AuthUser | null>();
  const f = fixture(vi.fn(() => check.promise));
  await f.controller.applySession(null);
  const snapshots: string[] = [];
  f.controller.subscribe(() =>
    snapshots.push(f.controller.getSnapshot().status),
  );
  const pending = f.controller.refresh();
  expect(f.controller.getSnapshot().status).toBe("guest");
  // focus and visibilitychange can arrive while the same check is outstanding.
  await f.controller.refresh();
  check.resolve(null);
  await pending;
  expect(snapshots).toEqual(["guest"]);
  expect(f.resetIdentity).not.toHaveBeenCalled();
});

it.each([
  new ApiError("offline", 0, undefined, false, "network"),
  new ApiError("timeout", 0, undefined, false, "timeout"),
  new ApiError("unavailable", 503),
])(
  "a temporary background failure preserves identity, queries and scope: %s",
  async (error) => {
    // Сценарий: Фоновый network/timeout/503 сохраняет личность, queries и scope.

    const f = fixture(
      vi.fn(async () => {
        throw error;
      }),
    );
    await f.controller.applySession(member(1));
    f.resetIdentity.mockClear();
    f.cache.setQueryData(["savedPosts"], ["SAVED_FOR_MEMBER_1"]);
    const scope = f.controller.getSnapshot().scope;
    await f.controller.refresh();
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "authenticated",
      user: { id: 1 },
      scope,
      error: null,
      refreshError: expect.any(Error),
    });
    expect(f.cache.getQueryData(["savedPosts"])).toEqual([
      "SAVED_FOR_MEMBER_1",
    ]);
    expect(f.resetIdentity).not.toHaveBeenCalled();
  },
);

it("a guest's failed background check does not become an initial loading screen", async () => {
  // Сценарий: Ошибка фоновой проверки гостя не становится стартовым экраном загрузки.

  const f = fixture(
    vi.fn(async () => {
      throw new ApiError("offline", 0, undefined, false, "network");
    }),
  );
  await f.controller.applySession(null);
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "guest",
    user: null,
    error: null,
    refreshError: expect.any(Error),
  });
});

it("a 401 followed by a failed recheck never restores the previous identity", async () => {
  // Сценарий: После 401 неудачная перепроверка не восстанавливает прежний доступ.

  const f = fixture(
    vi.fn(async () => {
      throw new ApiError("offline", 0, undefined, false, "network");
    }),
  );
  await f.controller.applySession(member(1));
  f.cache.setQueryData(["private"], "PRIVATE");
  f.controller.verifyAfterAccessError(401);
  await vi.waitFor(() =>
    expect(f.controller.getSnapshot().status).toBe("error"),
  );
  expect(f.controller.getSnapshot()).toMatchObject({
    user: null,
    refreshError: null,
  });
  expect(f.cache.getQueryData(["private"])).toBeUndefined();
});

it.each([401, 403])(
  "a session endpoint rejection clears previously confirmed access: %s",
  async (status) => {
    // Сценарий: Отказ самого endpoint сессии 401/403 удаляет подтверждённый доступ.

    const f = fixture(
      vi.fn(async () => {
        throw new ApiError("denied", status);
      }),
    );
    await f.controller.applySession(member(1));
    f.cache.setQueryData(["private"], "PRIVATE");
    await f.controller.refresh();
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "guest",
      user: null,
      refreshError: null,
    });
    expect(f.cache.getQueryData(["private"])).toBeUndefined();
  },
);

it("a malformed background session response still closes private access", async () => {
  // Сценарий: Повреждённый фоновый session-ответ закрывает приватные данные.

  const f = fixture(
    vi.fn(async () => {
      throw new ApiError("invalid", 0, undefined, false, "invalid-response");
    }),
  );
  await f.controller.applySession(member(1));
  f.cache.setQueryData(["private"], "PRIVATE");
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "error",
    user: null,
    refreshError: null,
  });
  expect(f.cache.getQueryData(["private"])).toBeUndefined();
});

it("a confirmed role change clears cached access and remounts the old screen", async () => {
  // Сценарий: Подтверждённая смена роли сбрасывает старый кеш прав и меняет область экрана.

  const f = fixture(vi.fn(async () => member(1)));
  await f.controller.applySession({ ...member(1), role: "admin" });
  const scope = f.controller.getSnapshot().scope;
  f.cache.setQueryData(["private"], "PRIVATE_ADMIN");
  await f.controller.refresh();
  expect(f.controller.getSnapshot().scope).toBeGreaterThan(scope);
  expect(f.controller.getSnapshot().user?.role).toBe("user");
  expect(f.cache.getQueryData(["private"])).toBeUndefined();
});

it.each(["stale success", "stale denial"])(
  "a confirmed profile write supersedes an earlier auth/me %s without clearing private state",
  async (reply) => {
    // Сценарий: Подтверждение записи профиля вытесняет более ранний auth/me без потери текущего приватного состояния.

    const beforeWrite = deferred<AuthUser | null>();
    const afterWrite = deferred<AuthUser | null>();
    let signal: AbortSignal | undefined;
    const getMe = vi.fn((currentSignal?: AbortSignal) => {
      signal ??= currentSignal;
      return getMe.mock.calls.length === 1
        ? beforeWrite.promise
        : afterWrite.promise;
    });
    const f = fixture(getMe);
    await f.controller.applySession(member(1));
    const scope = f.controller.getSnapshot().scope;
    f.cache.setQueryData(["private"], "KEEP_PRIVATE_STATE");
    f.resetIdentity.mockClear();
    const old = f.controller.refresh();
    expect(
      f.controller.confirmProfileUpdate(1, {
        name: "Confirmed name",
        gender: "female",
      }),
    ).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(getMe).toHaveBeenCalledTimes(2);
    beforeWrite.resolve(reply === "stale denial" ? null : member(1));
    await old;
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "authenticated",
      user: { id: 1, name: "Confirmed name", gender: "female" },
      scope,
    });
    expect(f.cache.getQueryData(["private"])).toBe("KEEP_PRIVATE_STATE");
    expect(f.resetIdentity).not.toHaveBeenCalled();
    afterWrite.resolve({
      ...member(1),
      name: "Canonical name",
      gender: "female",
    });
    await vi.waitFor(() =>
      expect(f.controller.getSnapshot().user?.name).toBe("Canonical name"),
    );
    f.controller.dispose();
  },
);

it("a failed post-write refresh retains the acknowledged profile and merges fields into the current session", async () => {
  // Сценарий: Неудачный post-write refresh сохраняет подтверждённые поля и объединяет их с текущим профилем.

  const getMe = vi.fn(async () => {
    throw new ApiError("offline", 0, undefined, false, "network");
  });
  const f = fixture(getMe);
  await f.controller.applySession({
    ...member(1),
    avatarUrl: "https://example.test/current.jpg",
  });
  expect(f.controller.confirmProfileUpdate(1, { name: "Saved name" })).toBe(
    true,
  );
  await vi.waitFor(() =>
    expect(f.controller.getSnapshot().refreshError).toBeInstanceOf(Error),
  );
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    user: { name: "Saved name", avatarUrl: "https://example.test/current.jpg" },
  });
  f.controller.dispose();
});

it("a photo ACK changes only the avatar, and late profile writes cannot change another account or a guest", async () => {
  // Сценарий: Квитанция фото меняет только аватар; старый owner не изменяет новый аккаунт или гостя.

  const waiting = deferred<AuthUser | null>();
  const f = fixture(vi.fn(() => waiting.promise));
  await f.controller.applySession({ ...member(1), gender: "female" });
  expect(
    f.controller.confirmProfileUpdate(1, {
      avatarUrl: "https://example.test/new.jpg",
    }),
  ).toBe(true);
  expect(f.controller.getSnapshot().user).toMatchObject({
    name: "Member 1",
    gender: "female",
    avatarUrl: "https://example.test/new.jpg",
  });
  await f.controller.applySession(member(2));
  const second = f.controller.getSnapshot();
  expect(f.controller.confirmProfileUpdate(1, { name: "Old owner" })).toBe(
    false,
  );
  expect(f.controller.getSnapshot()).toBe(second);
  await f.controller.applySession(null);
  expect(f.controller.confirmProfileUpdate(1, { name: "Old owner" })).toBe(
    false,
  );
  waiting.resolve(member(1));
  await Promise.resolve();
  expect(f.controller.getSnapshot().status).toBe("guest");
  f.controller.dispose();
});

it("profile ACK and reconciliation cannot cancel an in-flight sign-in", async () => {
  // Сценарий: Поздний profile ACK и reconcile не отменяют текущий вход другого аккаунта.

  const signIn = deferred<{ user: AuthUser }>();
  const f = fixture();
  await f.controller.applySession(member(1));
  const pending = f.controller.authenticate(() => signIn.promise);
  expect(f.controller.confirmProfileUpdate(1, { name: "Late ACK" })).toBe(
    false,
  );
  expect(await f.controller.reconcileProfile(1, member(1))).toBe(false);
  signIn.resolve({ user: member(2) });
  expect(await pending).toBe(true);
  expect(f.controller.getSnapshot().user?.id).toBe(2);
  expect(await f.controller.reconcileProfile(1, member(1))).toBe(false);
  expect(f.controller.getSnapshot().user?.id).toBe(2);
});

it("compares profile revisions only inside the same account", async () => {
  // Сценарий: Ревизии сравниваются только внутри одной личности; другой аккаунт не подчиняется старому номеру ревизии.

  const f = fixture();
  await f.controller.applySession({ ...member(1), profileRevision: 8 });
  expect(
    await f.controller.reconcileProfile(1, {
      ...member(1),
      profileRevision: 7,
    }),
  ).toBe(false);
  expect(f.controller.getSnapshot().user?.profileRevision).toBe(8);
  expect(
    await f.controller.reconcileProfile(1, {
      ...member(2),
      profileRevision: 0,
    }),
  ).toBe(false);
  expect(f.controller.getSnapshot().user?.id).toBe(2);
});

it("a late lower-revision profile ACK cannot overwrite a newer confirmed profile", async () => {
  // Сценарий: Запоздалая квитанция меньшей ревизии не перезаписывает более новый подтверждённый профиль.

  const f = fixture();
  await f.controller.applySession({
    ...member(1),
    name: "New B",
    profileRevision: 2,
  });
  expect(
    f.controller.confirmProfileUpdate(1, { name: "Old A", profileRevision: 1 }),
  ).toBe(false);
  expect(f.controller.getSnapshot().user).toMatchObject({
    name: "New B",
    profileRevision: 2,
  });
});
