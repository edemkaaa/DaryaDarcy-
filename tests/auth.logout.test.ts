/** Проверяем идемпотентную очистку гостевой cookie через прямой tRPC caller; серверный отзыв проверяется отдельными SQL/HTTP-сценариями. */
import { describe, expect, it } from "vitest";
import { appRouter } from "../apps/backend/src/routers";
import { COOKIE_NAME } from "../packages/shared/src/const";
import type { TrpcContext } from "../apps/backend/src/_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/** Строит синтетического пользователя и response-recorder, чтобы проверить точные параметры clearCookie. */
function createAuthContext(): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    phone: null, contactPhone: null,
    passwordHash: null,
    sessionVersion: 0, profileRevision: 0,
    blockedAt: null,
    blockedReason: null,
    accountDeletionRequestedAt: null,
    name: "Sample User",
    loginMethod: "manus",
    gender: null,
    avatarUrl: null,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

/** Здесь проверяется гостевой путь без записи БД; отзыв авторизованной сессии этим набором не подтверждается. */
describe("auth.logout", () => {
  /** Проверяем success и удаление правильной защищённой cookie без maxAge. */
  it("idempotently clears a guest session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    // Cookie cleanup is also idempotent for guests; authenticated revocation is
    // exercised over both real HTTP adapters in nest-sessions.mysql.test.ts.
    ctx.user = null;
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      secure: true,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
    expect(clearedCookies[0]?.options).not.toHaveProperty("maxAge");
  });
});
