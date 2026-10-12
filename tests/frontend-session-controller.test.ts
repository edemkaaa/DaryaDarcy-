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

const member = (id: number): AuthUser => ({
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
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture(
  getMe = vi.fn(async () => null as AuthUser | null),
  logout = vi.fn(async () => {}),
) {
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

it("post-mutation refresh replaces a pre-write read without resetting the owner's private scope", async () => {
  const old = deferred<AuthUser | null>();
  const updated = { ...member(1), name: "Acknowledged name" };
  const getMe = vi
    .fn()
    .mockImplementationOnce(() => old.promise)
    .mockResolvedValue(updated);
  const f = fixture(getMe);
  await f.controller.applySession(member(1));
  f.cache.setQueryData(["savedPosts"], ["PRIVATE_MEMBER_1"]);
  const scope = f.controller.getSnapshot().scope;
  const pending = f.controller.refresh();
  await f.controller.refreshAfterMutation(1);
  old.resolve(member(1));
  await pending;
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    user: updated,
    scope,
  });
  expect(f.cache.getQueryData(["savedPosts"])).toEqual(["PRIVATE_MEMBER_1"]);
});

it("post-mutation refresh does not cancel a pending login", async () => {
  const f = fixture();
  await f.controller.applySession(member(1));
  const login = deferred<{ user: AuthUser }>();
  let signal!: AbortSignal;
  const pending = f.controller.authenticate((s) => {
    signal = s;
    return login.promise;
  });
  await f.controller.refreshAfterMutation(1);
  expect(signal.aborted).toBe(false);
  login.resolve({ user: member(2) });
  expect(await pending).toBe(true);
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    user: { id: 2 },
  });
});

it("a previous owner's mutation cannot refresh the new account", async () => {
  const f = fixture();
  await f.controller.applySession(member(2));
  const snapshot = f.controller.getSnapshot();
  await f.controller.refreshAfterMutation(1);
  expect(f.controller.getSnapshot()).toBe(snapshot);
});

it.each([200, 401])(
  "a late loopback session response (%s) cannot replace the new account or its private cache",
  async (status) => {
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
  const f = fixture();
  const never = deferred<string>();
  const oldQuery = f.cache
    .fetchQuery({ queryKey: ["slow"], queryFn: () => never.promise })
    .catch(() => undefined);
  await f.controller.applySession(member(1));
  expect(f.controller.getSnapshot().status).toBe("authenticated");
  never.resolve("old");
  await oldQuery;
  expect(f.cache.getQueryData(["slow"])).toBeUndefined();
});

it("initial network failure is a recoverable error, not a confirmed guest", async () => {
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
  const f = fixture();
  const login = deferred<{ user: AuthUser }>();
  const pending = f.controller.authenticate(() => login.promise);
  await f.controller.logout();
  login.resolve({ user: member(1) });
  expect(await pending).toBe(false);
  expect(f.controller.getSnapshot().status).toBe("guest");
});

it("initial refresh can restart after Strict Mode cleanup", async () => {
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

it("a 403 permission failure does not discard a valid identity or cause query refetch loops", async () => {
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
  const f = fixture(vi.fn(async () => member(1)));
  await f.controller.applySession({ ...member(1), role: "admin" });
  const scope = f.controller.getSnapshot().scope;
  f.cache.setQueryData(["private"], "PRIVATE_ADMIN");
  await f.controller.refresh();
  expect(f.controller.getSnapshot().scope).toBeGreaterThan(scope);
  expect(f.controller.getSnapshot().user?.role).toBe("user");
  expect(f.cache.getQueryData(["private"])).toBeUndefined();
});
