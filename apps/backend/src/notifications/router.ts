import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import type { ContentReadService } from "../content/content-read.service";
import type { NotificationsService } from "./notifications.service";
import {
  registerTokenInput,
  setMarketingConsentInput,
} from "./notification-input";
import { TRPCError } from "@trpc/server";
import { requireCapability } from "../launch/capabilities";
import { enforcePushRegistrationLimit } from "./registration-limit";

export const createNotificationsRouter = (
  notifications: NotificationsService,
  content: ContentReadService,
) =>
  router({
    // Guest devices remain supported only when the server capability permits it.
    registerToken: publicProcedure
      .use(async ({ ctx, next }) => {
        requireCapability("webPush");
        if (ctx.user?.blockedAt)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Аккаунт заблокирован",
          });
        await enforcePushRegistrationLimit(ctx.req, ctx.res, ctx.user?.id);
        return next();
      })
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
    latest: publicProcedure.query(({ ctx }) =>
      content.latestNotification(ctx.user),
    ),
  });
