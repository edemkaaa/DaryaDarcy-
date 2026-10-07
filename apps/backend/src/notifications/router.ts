import {
  router,
  publicProcedure,
  protectedProcedure,
  userHasClubAccess,
} from "../_core/trpc";
import * as db from "../db";
import type { NotificationsService } from "./notifications.service";
import {
  registerTokenInput,
  setMarketingConsentInput,
} from "./notification-input";

export const createNotificationsRouter = (
  notifications: NotificationsService,
) =>
  router({
    // Register device push token (public - any device can register)
    registerToken: publicProcedure
      .input(registerTokenInput)
      .mutation(({ input, ctx }) =>
        notifications.registerToken(input, ctx.user?.id),
      ),
    marketingConsent: protectedProcedure.query(({ ctx }) =>
      notifications.marketingConsent(ctx.user.id),
    ),
    setMarketingConsent: protectedProcedure
      .input(setMarketingConsentInput)
      .mutation(({ input, ctx }) =>
        notifications.setMarketingConsent(ctx.user.id, input),
      ),
    latest: publicProcedure.query(async ({ ctx }) => {
      const feed = await db.getLatestPublishedPost("feed");
      let club: { id: number; text: string } | undefined;
      if (ctx.user && (await userHasClubAccess(ctx.user))) {
        club = await db.getLatestPublishedPost("club");
      }
      return {
        feedId: feed?.id ?? null,
        feedText: feed?.text ?? "",
        clubId: club?.id ?? null,
        clubText: club?.text ?? "",
      };
    }),
  });
