import { expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { SessionController } from "../apps/frontend/src/domain/session/session-controller";
import { ApiError, type AuthUser } from "../apps/frontend/src/shared/api/auth";

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

it("network failure is a recoverable error, not a confirmed guest", async () => {
  const getMe = vi.fn(async () => {
    throw new ApiError("Нет сети", 0, undefined, false, "network");
  });
  const f = fixture(getMe);
  await f.controller.applySession(member(1));
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "error",
    user: null,
  });
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
  expect(f.controller.getSnapshot()).toMatchObject({ status: "error", scope });
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    status: "authenticated",
    scope,
  });
  await f.controller.applySession(member(2));
  expect(f.controller.getSnapshot().scope).toBeGreaterThan(scope);
});
