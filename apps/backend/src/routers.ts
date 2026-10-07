import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./identity/router";
import { createProfileRouter, createProfileExtrasRouter } from "./profile/router";
import { ProfileService } from "./profile/profile.service";
import { createVideosRouter } from "./content/videos-router";
import { createAdminRouter } from "./admin/router";
import { penPalsRouter } from "./pen-pals/router";
import { shopRouter } from "./shop/router";
import { createFeedRouter } from "./content/feed-router";
import { ContentReadService } from "./content/content-read.service";
import { ContentWriteService } from "./content/content-write.service";
import { createArticlesRouter } from "./content/articles-router";
import { createNotificationsRouter } from "./notifications/router";
import { NotificationsService } from "./notifications/notifications.service";
import { createClubRouter } from "./club/router";
import { ContentCommentService } from "./content/content-comment.service";
import { ContentUploadService } from "./content/content-upload.service";
import { moderationRouter } from "./moderation/router";
import { ClubCheckoutService } from "./billing/club-checkout.service";
import { ClubSubscriptionService } from "./billing/club-subscription.service";
import type { ClubBillingServices } from "./billing/billing.module";

/** Composition only: input validation, authorization and behavior live in domains. */
export const createAppRouter = (
  content: ContentReadService,
  posts: ContentWriteService,
  comments: ContentCommentService,
  uploads: ContentUploadService,
  billing: ClubBillingServices,
  notifications: NotificationsService,
  profiles: ProfileService,
) =>
  router({
    system: systemRouter,
    auth: authRouter,
    profile: createProfileRouter(profiles),
    feed: createFeedRouter(content, posts),
    notifications: createNotificationsRouter(notifications, content),
    videos: createVideosRouter(content),
    admin: createAdminRouter(content, posts, uploads, notifications),
    club: createClubRouter(comments, billing),
    penPals: penPalsRouter,
    shop: shopRouter,
    moderation: moderationRouter,
    profileExtras: createProfileExtrasRouter(profiles),
    articles: createArticlesRouter(content),
  });

// Standalone callers/tools use the same factories; HTTP supplies Nest's service.
// Construction performs no database access and starts no jobs or listeners.
export const appRouter = createAppRouter(
  new ContentReadService(),
  new ContentWriteService(),
  new ContentCommentService(),
  new ContentUploadService(),
  {
    checkout: new ClubCheckoutService(),
    subscriptions: new ClubSubscriptionService(),
  },
  new NotificationsService(),
  new ProfileService(),
);

export type AppRouter = typeof appRouter;
