import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ClubPayment, User } from "../packages/database/src/schema";
import { ClubSubscriptionService } from "../apps/backend/src/billing/club-subscription.service";
import * as db from "../apps/backend/src/db";
import * as cancellation from "../apps/backend/src/billing/cancellation";
import {
  cancelProdamusSubscription,
  CLUB_PRICE,
} from "../apps/backend/src/prodamus";

const member: User = {
  id: 7,
  openId: "subscription-fixture",
  email: "member@example.test",
  name: null,
  phone: null, contactPhone: null,
  passwordHash: null,
  sessionVersion: 0, profileRevision: 0,
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
const paid: ClubPayment = {
      contactPhone: null,
  id: 11,
  userId: 7,
  orderId: "club-7-confirmed",
  email: member.email,
  sum: "790",
  status: "paid",
  paidAt: new Date(0),
  expiresAt: paidUntil,
  cancelAtPeriodEnd: true,
  cancelledAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const service = new ClubSubscriptionService();
// Selected read transport only; SQL predicates/ownership are tested on MySQL.
// Cancellation write tests replace the durable helper, not the service.
const database = {
  async transaction(
    run: (reader: unknown) => Promise<unknown>,
  ): Promise<unknown> {
    return run(this);
  },
  select: () => ({
    from: () => ({ where: () => ({ limit: async () => [] }) }),
  }),
} as unknown as NonNullable<Awaited<ReturnType<typeof db.getDb>>>;
beforeEach(() => {
  vi.spyOn(db, "getDb").mockResolvedValue(database);
});
afterEach(() => vi.restoreAllMocks());

it.each([null, { ...member, role: "admin" as const, blockedAt: new Date(0) }])(
  "guest/blocked status is unsubscribed without reading paid access",
  async (actor) => {
    const read = vi
      .spyOn(db, "getActiveClubSubscription")
      .mockRejectedValue(new Error("must not read"));
    expect(await service.subscription(actor)).toEqual({
      hasClubAccess: false,
      subscribed: false,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancellationStatus: "none",
      isOwner: false,
      monthlyPrice: CLUB_PRICE,
    });
    expect(read).not.toHaveBeenCalled();
  },
);
it.each(["user", "moderator", "admin"] as const)(
  "%s status retains the explicit owner policy",
  async (role) => {
    vi.spyOn(db, "getActiveClubSubscription").mockImplementation(
      async (userId) => {
        expect(userId).toBe(7);
        return undefined;
      },
    );
    expect(await service.subscription({ ...member, role })).toEqual({
      hasClubAccess: role !== "user",
      subscribed: role === "admin",
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancellationStatus: "none",
      isOwner: role === "admin",
      monthlyPrice: CLUB_PRICE,
    });
  },
);
it("paid status preserves the expiry and confirmed cancellation flag", async () => {
  vi.spyOn(db, "getActiveClubSubscription").mockResolvedValue(paid);
  expect(await service.subscription(member)).toEqual({
    hasClubAccess: true,
    subscribed: true,
    expiresAt: paidUntil,
    cancelAtPeriodEnd: true,
    cancellationStatus: "confirmed",
    isOwner: false,
    monthlyPrice: CLUB_PRICE,
  });
});
it("claim reports verified paid access without activating a pending checkout", async () => {
  vi.spyOn(db, "getActiveClubSubscription").mockImplementation(async (id) => {
    expect(id).toBe(7);
    return paid;
  });
  const databaseAccess = vi
    .spyOn(db, "getDb")
    .mockRejectedValue(new Error("must not write"));
  expect(await service.claimPending(7)).toEqual({
    granted: true,
    orderId: "club-7-confirmed",
  });
  expect(databaseAccess).not.toHaveBeenCalled();
});
it("a checkout alone cannot be claimed as paid", async () => {
  vi.spyOn(db, "getActiveClubSubscription").mockResolvedValue(undefined);
  const databaseAccess = vi
    .spyOn(db, "getDb")
    .mockRejectedValue(new Error("must not write"));
  expect(await service.claimPending(7)).toEqual({
    granted: false,
    orderId: null,
  });
  expect(databaseAccess).not.toHaveBeenCalled();
});
it.each(["subscription", "claimPending"] as const)(
  "%s does not turn a failed read into a false success",
  async (method) => {
    vi.spyOn(db, "getActiveClubSubscription").mockRejectedValue(
      new Error("synthetic SQL outage"),
    );
    const result =
      method === "subscription"
        ? service.subscription(member)
        : service.claimPending(7);
    await expect(result).rejects.toThrow("synthetic SQL outage");
  },
);
it("cancellation fails closed without a database", async () => {
  vi.spyOn(db, "getDb").mockResolvedValue(null);
  const request = vi.spyOn(cancellation, "requestClubCancellation");
  await expect(service.cancel(7)).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
  expect(request).not.toHaveBeenCalled();
});
it("a business cancellation refusal has a safe public client error", async () => {
  vi.spyOn(db, "getDb").mockResolvedValue(database);
  vi.spyOn(cancellation, "requestClubCancellation").mockRejectedValue(
    new cancellation.CancellationUnavailableError("PRIVATE_LOOKUP_DETAIL"),
  );
  await expect(service.cancel(7)).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "Не удалось определить подписку. Обратитесь в поддержку.",
  });
});
it("unexpected cancellation failures remain server errors without private details", async () => {
  vi.spyOn(cancellation, "requestClubCancellation").mockRejectedValue(
    new Error("PRIVATE_SQL_DETAIL"),
  );
  await expect(service.cancel(7)).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
    message: expect.not.stringContaining("PRIVATE_SQL_DETAIL"),
  });
});
it("an accepted cancellation reports pending instead of a server error", async () => {
  vi.spyOn(db, "getDb").mockResolvedValue(database);
  vi.spyOn(cancellation, "requestClubCancellation").mockResolvedValue({
    confirmed: false,
    expiresAt: paidUntil,
  });
  await expect(service.cancel(7)).resolves.toMatchObject({
    ok: true,
    cancellationStatus: "pending",
    expiresAt: paidUntil,
    message: expect.stringContaining("пока не подтвердила отмену"),
  });
});
it("subscription reads expose a persisted pending cancellation without claiming auto-renewal has stopped", async () => {
  vi.spyOn(db, "getActiveClubSubscription").mockResolvedValue({
    ...paid,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
  });
  // Only the selected SQL transport is doubled. The service must actually
  // derive pending from durable profile state; a missing response field fails RED.
  vi.spyOn(db, "getDb").mockResolvedValue({
    ...database,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ profileKey: "synthetic-pending-profile" }],
        }),
      }),
    }),
  } as unknown as typeof database);
  expect(await service.subscription(member)).toMatchObject({
    hasClubAccess: true,
    subscribed: true,
    cancellationStatus: "pending",
    cancelAtPeriodEnd: false,
    expiresAt: paidUntil,
  });
});
it.each([paidUntil, null])(
  "confirmed cancellation retains paid expiry %s",
  async (expiresAt) => {
    vi.spyOn(db, "getDb").mockResolvedValue(database);
    vi.spyOn(cancellation, "requestClubCancellation").mockImplementation(
      async (handle, userId, send) => {
        expect(handle).toBe(database);
        expect(userId).toBe(7);
        expect(send).toBe(cancelProdamusSubscription);
        return { confirmed: true, expiresAt };
      },
    );
    expect(await service.cancel(7)).toMatchObject({
      ok: true,
      cancellationStatus: "confirmed",
      expiresAt,
      message: expect.any(String),
    });
  },
);
