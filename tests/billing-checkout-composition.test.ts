import { afterEach, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { createAppRouter } from "../apps/backend/src/routers";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { ContentCommentService } from "../apps/backend/src/content/content-comment.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { ClubSubscriptionService } from "../apps/backend/src/billing/club-subscription.service";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { NotificationsService } from "../apps/backend/src/notifications/notifications.service";
import { ProfileService } from "../apps/backend/src/profile/profile.service";
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
import { ShopService } from "../apps/backend/src/shop/shop.service";

afterEach(() => vi.unstubAllEnvs());

function caller(checkout: {
  createCheckout: (
    user: TrpcContext["user"],
    input?: { email?: string; plan?: "monthly" | "semiannual" },
  ) => Promise<{ url: string; user: null }>;
}) {
  return createAppRouter(
    new ContentReadService(),
    new ContentWriteService(),
    new ContentCommentService(),
    new ContentUploadService(),
    {
      checkout: {
        ...checkout,
        reconcileCheckout: (actor, key) =>
          new ClubCheckoutService().reconcileCheckout(actor, key),
      },
      subscriptions: new ClubSubscriptionService(),
      shop: new ShopService(),
    },
    new NotificationsService(),
    new ProfileService(),
    new ModerationService(),
  ).createCaller({ user: null, req: {}, res: {} } as TrpcContext);
}

it("routes checkout through the supplied service instead of global billing state", async () => {
  // A direct/global DB path fails here; the actual consumer result proves DI.
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PRODAMUS_SECRET", "");
  const checkout = caller({
    async createCheckout(user, input) {
      expect(user).toBeNull();
      expect(input).toEqual({
        email: "guest@example.test",
        plan: "semiannual",
      });
      return {
        url: "https://fixture.payform.ru/?order_id=injected",
        user: null,
      };
    },
  });
  expect(
    await checkout.club.createCheckout({
      email: "guest@example.test",
      plan: "semiannual",
    }),
  ).toEqual({
    url: "https://fixture.payform.ru/?order_id=injected",
    user: null,
  });
});

it("preserves the service failure code at the checkout boundary", async () => {
  vi.stubEnv("DATABASE_URL", "");
  const checkout = caller({
    async createCheckout() {
      throw new TRPCError({
        code: "CONFLICT",
        message: "synthetic checkout rejection",
      });
    },
  });
  await expect(
    checkout.club.createCheckout({ email: "guest@example.test" }),
  ).rejects.toMatchObject({
    code: "CONFLICT",
    message: "synthetic checkout rejection",
  });
});

it("rejects malformed checkout input before entering the service", async () => {
  const checkout = caller({
    async createCheckout() {
      throw new Error("must not reach billing service");
    },
  });
  await expect(
    checkout.club.createCheckout({ email: "invalid" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
