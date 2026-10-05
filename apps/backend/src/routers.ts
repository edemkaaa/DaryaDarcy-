import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./identity/router";
import { profileRouter, profileExtrasRouter } from "./profile/router";
import { videosRouter } from "./content/videos-router";
import { createAdminRouter } from "./admin/router";
import { penPalsRouter } from "./pen-pals/router";
import { shopRouter } from "./shop/router";
import { createFeedRouter } from "./content/feed-router";
import { ContentReadService } from "./content/content-read.service";
import { ContentWriteService } from "./content/content-write.service";
import { createArticlesRouter } from "./content/articles-router";
import { notificationsRouter } from "./notifications/router";
import { clubRouter } from "./club/router";
import { moderationRouter } from "./moderation/router";

/** Composition only: input validation, authorization and behavior live in domains. */
export const createAppRouter = (
  content: ContentReadService,
  posts: ContentWriteService,
) =>
  router({
    system: systemRouter,
    auth: authRouter,
    profile: profileRouter,
    feed: createFeedRouter(content),
    notifications: notificationsRouter,
    videos: videosRouter,
    admin: createAdminRouter(posts),
    club: clubRouter,
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
);

export type AppRouter = typeof appRouter;
