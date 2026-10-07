import { afterEach, expect, it, vi } from "vitest";
import { createAppRouter } from "../apps/backend/src/routers";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { ContentCommentService } from "../apps/backend/src/content/content-comment.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import type { User } from "../packages/database/src/schema";
import { NotificationsService } from "../apps/backend/src/notifications/notifications.service";
import { ProfileService } from "../apps/backend/src/profile/profile.service";

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
const subscriptions = {
  async subscription(_actor: User | null) {
    return {
      subscribed: true,
      expiresAt: paidUntil,
      cancelAtPeriodEnd: false,
      isOwner: false,
      monthlyPrice: "1250",
    };
  },
  async claimPending(userId: number) {
    expect(userId).toBe(7);
    return { granted: true as const, orderId: "club-7-confirmed" };
  },
  async cancel(userId: number) {
    expect(userId).toBe(7);
    return { ok: true as const, expiresAt: paidUntil };
  },
};
function caller(user: User | null = member) {
  return createAppRouter(
    new ContentReadService(),
    new ContentWriteService(),
    new ContentCommentService(),
    new ContentUploadService(),
    { checkout: new ClubCheckoutService(), subscriptions },
    new NotificationsService(),
    new ProfileService(),
  ).createCaller({ user, req: {}, res: {} } as TrpcContext);
}
afterEach(() => vi.unstubAllEnvs());

it("subscription status uses the supplied billing service", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(await caller().club.subscription()).toEqual({
    subscribed: true,
    expiresAt: paidUntil,
    cancelAtPeriodEnd: false,
    isOwner: false,
    monthlyPrice: "1250",
  });
});
it("claimPending reports the supplied service's verified order", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(await caller().club.claimPending()).toEqual({
    granted: true,
    orderId: "club-7-confirmed",
  });
});
it("cancellation uses the supplied service and retains paid expiry", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(await caller().club.cancel()).toEqual({
    ok: true,
    expiresAt: paidUntil,
  });
});
it.each(["cancel", "claimPending"] as const)(
  "anonymous %s stays protected",
  async (method) => {
    await expect(caller(null).club[method]()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  },
);
it.each(["cancel", "claimPending"] as const)(
  "blocked %s stays protected",
  async (method) => {
    await expect(
      caller({ ...member, blockedAt: new Date(0) }).club[method](),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  },
);
