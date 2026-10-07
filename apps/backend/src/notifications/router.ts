import {
  router,
  publicProcedure,
  protectedProcedure,
} from "../_core/trpc";
import type { ContentReadService } from "../content/content-read.service";
import type { NotificationsService } from "./notifications.service";
import {
  registerTokenInput,
  setMarketingConsentInput,
} from "./notification-input";

export const createNotificationsRouter = (
  notifications: NotificationsService,
  content: ContentReadService,
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
    latest: publicProcedure.query(({ ctx }) =>
      content.latestNotification(ctx.user),
    ),
  });
