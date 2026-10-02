import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  userHasClubAccess,
} from "../_core/trpc";
import * as db from "../db";
import {
  MARKETING_PUSH_CONSENT_LABEL,
  MARKETING_PUSH_CONSENT_VERSION,
} from "../../../../packages/shared/src/push-consent";

export const notificationsRouter = router({
  // Register device push token (public - any device can register)
  registerToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        platform: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.registerPushToken(input.token, ctx.user?.id, input.platform);
      return { success: true };
    }),
  marketingConsent: protectedProcedure.query(async ({ ctx }) => {
    const enabled = await db.hasMarketingPushConsent(ctx.user.id);
    return {
      enabled,
      label: MARKETING_PUSH_CONSENT_LABEL,
      version: MARKETING_PUSH_CONSENT_VERSION,
    };
  }),
  setMarketingConsent: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        platform: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.logPushConsentEvent(
        ctx.user.id,
        "marketing",
        input.enabled ? "granted" : "revoked",
        input.platform,
        MARKETING_PUSH_CONSENT_VERSION,
        MARKETING_PUSH_CONSENT_LABEL,
      );
      return { success: true, enabled: input.enabled };
    }),
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
