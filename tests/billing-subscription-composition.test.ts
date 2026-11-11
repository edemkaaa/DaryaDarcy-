/** Тест роутерной композиции с непрозрачным subscription-портом: не подтверждает настоящий settlement или SQL. */
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
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";
import { ShopService } from "../apps/backend/src/shop/shop.service";

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
const subscriptions = {
  /** Синтетический порт возвращает заранее заданный действующий период и цену для проверки передачи ответа. */
  async subscription(_actor: User | null) {
    return {
      hasClubAccess: true,
      subscribed: true,
      expiresAt: paidUntil,
      cancelAtPeriodEnd: false,
      cancellationStatus: "none" as const,
      isOwner: false,
      monthlyPrice: "1250",
    };
  },
  /** Порт проверяет userId и возвращает фиктивное уже подтверждённое назначение. */
  async claimPending(userId: number) {
    expect(userId).toBe(7);
    return { granted: true as const, orderId: "club-7-confirmed" };
  },
  /** Порт получает полный actor и возвращает confirmed с сохранённым концом оплаченного периода. */
  async cancel(actor: User) {
    expect(actor).toEqual(member);
    return {
      ok: true as const,
      cancellationStatus: "confirmed" as const,
      expiresAt: paidUntil,
      message: "synthetic supplied cancellation confirmation",
    };
  },
};
/** Собираем настоящий AppRouter вокруг переданного subscription provider и выбранного actor. */
function caller(user: User | null = member) {
  return createAppRouter(
    new ContentReadService(),
    new ContentWriteService(),
    new ContentCommentService(),
    new ContentUploadService(),
    {
      checkout: new ClubCheckoutService(),
      subscriptions,
      shop: new ShopService(),
    },
    new NotificationsService(),
    new ProfileService(),
    new ModerationService(),
  ).createCaller({ user, req: {}, res: {} } as TrpcContext);
}
/** Снимаем DATABASE_URL подстановку. */
afterEach(() => vi.unstubAllEnvs());

/** Ответ статуса берётся из внедрённого сервиса, не глобального фасада. */
it("subscription status uses the supplied billing service", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(await caller().club.subscription()).toEqual({
    hasClubAccess: true,
    subscribed: true,
    expiresAt: paidUntil,
    cancelAtPeriodEnd: false,
    cancellationStatus: "none",
    isOwner: false,
    monthlyPrice: "1250",
  });
});
/** Роутер сохраняет grant/orderId возвращённого порта. */
it("claimPending reports the supplied service's verified order", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(await caller().club.claimPending()).toEqual({
    granted: true,
    orderId: "club-7-confirmed",
  });
});
/** Cancel DTO не теряет status, expiresAt и разрешённое сообщение. */
it("cancellation uses the supplied service and retains paid expiry", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(await caller().club.cancel()).toEqual({
    ok: true,
    cancellationStatus: "confirmed",
    expiresAt: paidUntil,
    message: "synthetic supplied cancellation confirmation",
  });
});
/** Без сессии cancel/claimPending отвергаются до service. */
it.each(["cancel", "claimPending"] as const)(
  "anonymous %s stays protected",
  async (method) => {
    await expect(caller(null).club[method]()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  },
);
/** Blocked actor не проходит защищённые операции. */
it.each(["cancel", "claimPending"] as const)(
  "blocked %s stays protected",
  async (method) => {
    await expect(
      caller({ ...member, blockedAt: new Date(0) }).club[method](),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  },
);
