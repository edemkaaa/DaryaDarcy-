import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./identity/router";
import { profileRouter, profileExtrasRouter } from "./profile/router";
import { videosRouter } from "./content/videos-router";
import { adminRouter } from "./admin/router";
import { penPalsRouter } from "./pen-pals/router";
import { shopRouter } from "./shop/router";
import { feedRouter } from "./content/feed-router";
import { articlesRouter } from "./content/articles-router";
import { notificationsRouter } from "./notifications/router";
import { clubRouter } from "./club/router";
import { moderationRouter } from "./moderation/router";

/** Composition only: input validation, authorization and behavior live in domains. */
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  profile: profileRouter,
  feed: feedRouter,
  notifications: notificationsRouter,
  videos: videosRouter,
  admin: adminRouter,
  club: clubRouter,
  penPals: penPalsRouter,
  shop: shopRouter,
  moderation: moderationRouter,
  profileExtras: profileExtrasRouter,
  articles: articlesRouter,
});

export type AppRouter = typeof appRouter;
