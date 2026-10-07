import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ClubSubscriptionService } from "../apps/backend/src/billing/club-subscription.service";
import { SessionService } from "../apps/backend/src/identity/session.service";
import type { AppRouter } from "../apps/backend/src/routers";
import type { User } from "../packages/database/src/schema";

const member: User = {
  id: 7,
  openId: "subscription-fixture",
  email: "member@example.test",
  name: null,
  phone: null,
  passwordHash: null,
  sessionVersion: 0,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  role: "user",
  blockedAt: null,
  blockedReason: null,
  accountDeletionRequestedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(0),
};
const paidUntil = new Date("2026-11-01T00:00:00Z");
let application: INestApplication;
let base: string;
let subscriptions: ClubSubscriptionService;
let sessions: SessionService;
const client = () =>
  createTRPCProxyClient<AppRouter>({
    links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
  });
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  application = await createBackendApplication();
  subscriptions = application.get(ClubSubscriptionService);
  sessions = application.get(SessionService);
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await application?.close();
  vi.unstubAllEnvs();
});
it("HTTP status uses the Nest-managed subscription provider for guests", async () => {
  vi.spyOn(sessions, "optionalUser").mockResolvedValue(null);
  vi.spyOn(subscriptions, "subscription").mockImplementation(async (actor) => {
    expect(actor).toBeNull();
    return {
      subscribed: false,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      isOwner: false,
      monthlyPrice: "1250",
    };
  });
  expect(await client().club.subscription.query()).toEqual({
    subscribed: false,
    expiresAt: null,
    cancelAtPeriodEnd: false,
    isOwner: false,
    monthlyPrice: "1250",
  });
});
it("HTTP claim uses the verified session ID and Nest provider", async () => {
  // Only the existing identity/billing boundaries are replaced; HTTP, tRPC,
  // authorization middleware and serialization remain real. This is not JWT/SQL acceptance.
  vi.spyOn(sessions, "optionalUser").mockResolvedValue(member);
  vi.spyOn(subscriptions, "claimPending").mockImplementation(async (id) => {
    expect(id).toBe(7);
    return { granted: true as const, orderId: "club-7-confirmed" };
  });
  expect(await client().club.claimPending.mutate()).toEqual({
    granted: true,
    orderId: "club-7-confirmed",
  });
});
it("HTTP cancellation retains paid expiry via the Nest provider", async () => {
  vi.spyOn(sessions, "optionalUser").mockResolvedValue(member);
  vi.spyOn(subscriptions, "cancel").mockImplementation(async (id) => {
    expect(id).toBe(7);
    return { ok: true as const, expiresAt: paidUntil };
  });
  expect(await client().club.cancel.mutate()).toEqual({
    ok: true,
    expiresAt: paidUntil,
  });
});
it.each(["cancel", "claimPending"] as const)(
  "anonymous HTTP %s is rejected before billing",
  async (method) => {
    vi.spyOn(sessions, "optionalUser").mockResolvedValue(null);
    const operation = vi.spyOn(subscriptions, method);
    await expect(client().club[method].mutate()).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED", httpStatus: 401 },
    });
    expect(operation).not.toHaveBeenCalled();
  },
);
it.each(["cancel", "claimPending"] as const)(
  "blocked HTTP %s is rejected before billing",
  async (method) => {
    vi.spyOn(sessions, "optionalUser").mockResolvedValue({
      ...member,
      blockedAt: new Date(0),
    });
    const operation = vi.spyOn(subscriptions, method);
    await expect(client().club[method].mutate()).rejects.toMatchObject({
      data: { code: "FORBIDDEN", httpStatus: 403 },
    });
    expect(operation).not.toHaveBeenCalled();
  },
);
it("HTTP cancellation failure remains a safe failure, not success", async () => {
  vi.spyOn(sessions, "optionalUser").mockResolvedValue(member);
  vi.spyOn(subscriptions, "cancel").mockRejectedValue(
    new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "PRIVATE_PROVIDER_DETAIL",
    }),
  );
  await expect(client().club.cancel.mutate()).rejects.toMatchObject({
    message: "Внутренняя ошибка сервера",
    data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
  });
});
