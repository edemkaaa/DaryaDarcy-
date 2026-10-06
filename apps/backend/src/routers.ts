import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./identity/router";
import { profileRouter, profileExtrasRouter } from "./profile/router";
import { createVideosRouter } from "./content/videos-router";
import { createAdminRouter } from "./admin/router";
import { penPalsRouter } from "./pen-pals/router";
import { shopRouter } from "./shop/router";
import { createFeedRouter } from "./content/feed-router";
import { ContentReadService } from "./content/content-read.service";
import { ContentWriteService } from "./content/content-write.service";
import { createArticlesRouter } from "./content/articles-router";
import { notificationsRouter } from "./notifications/router";
import { createClubRouter } from "./club/router";
import { ContentCommentService } from "./content/content-comment.service";
import { ContentUploadService } from "./content/content-upload.service";
import { moderationRouter } from "./moderation/router";
import { ClubCheckoutService } from "./billing/club-checkout.service";

/** Composition only: input validation, authorization and behavior live in domains. */
export const createAppRouter = (
  content: ContentReadService,
  posts: ContentWriteService,
  comments: ContentCommentService,
  uploads: ContentUploadService,
  checkout: ClubCheckoutService,
) =>
  router({
    system: systemRouter,
    auth: authRouter,
    profile: profileRouter,
    feed: createFeedRouter(content, posts),
    notifications: notificationsRouter,
    videos: createVideosRouter(content),
    admin: createAdminRouter(content, posts, uploads),
    club: createClubRouter(comments, checkout),
    penPals: penPalsRouter,
    shop: shopRouter,
    moderation: moderationRouter,
    profileExtras: profileExtrasRouter,
    articles: createArticlesRouter(content),
  });

// Standalone callers/tools use the same factories; HTTP supplies Nest's service.
// Construction performs no database access and starts no jobs or listeners.
export const appRouter = createAppRouter(
  new ContentReadService(),
  new ContentWriteService(),
  new ContentCommentService(),
  new ContentUploadService(),
  new ClubCheckoutService(),
);

export type AppRouter = typeof appRouter;
