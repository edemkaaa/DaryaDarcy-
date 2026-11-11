/** Корневой состав tRPC объединяет доменные роутеры в общий контракт клиента. */
import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { createAuthRouter } from "./identity/router";
import { SessionService } from "./identity/session.service";
import {
  createProfileRouter,
  createProfileExtrasRouter,
} from "./profile/router";
import { ProfileService } from "./profile/profile.service";
import { createVideosRouter } from "./content/videos-router";
import { createAdminRouter } from "./admin/router";
import { penPalsRouter } from "./pen-pals/router";
import { createShopRouter } from "./shop/router";
import { ShopService } from "./shop/shop.service";
import { createFeedRouter } from "./content/feed-router";
import { ContentReadService } from "./content/content-read.service";
import { ContentWriteService } from "./content/content-write.service";
import { createArticlesRouter } from "./content/articles-router";
import { createNotificationsRouter } from "./notifications/router";
import { NotificationsService } from "./notifications/notifications.service";
import { createClubRouter } from "./club/router";
import { ContentCommentService } from "./content/content-comment.service";
import { ContentUploadService } from "./content/content-upload.service";
import { createModerationRouter } from "./moderation/router";
import { ModerationService } from "./moderation/moderation.service";
import { ClubCheckoutService } from "./billing/club-checkout.service";
import { ClubSubscriptionService } from "./billing/club-subscription.service";
import type { BillingServices } from "./billing/billing.module";

/** Composition only: input validation, authorization and behavior live in domains. */
/** Объединяет доменные фабрики с конкретными сервисами приложения; валидация, доступ и SQL-поведение остаются у доменов. */
export const createAppRouter = (
  content: ContentReadService,
  posts: ContentWriteService,
  comments: ContentCommentService,
  uploads: ContentUploadService,
  billing: BillingServices,
  notifications: NotificationsService,
  profiles: ProfileService,
  moderation: ModerationService,
  sessions: Pick<SessionService, "revokeSessions"> = new SessionService(),
) =>
  router({
    system: systemRouter,
    auth: createAuthRouter(sessions),
    profile: createProfileRouter(profiles),
    feed: createFeedRouter(content, posts),
    notifications: createNotificationsRouter(notifications, content),
    videos: createVideosRouter(content),
    admin: createAdminRouter(content, posts, uploads, notifications),
    club: createClubRouter(comments, billing),
    penPals: penPalsRouter,
    shop: createShopRouter(billing.shop),
    moderation: createModerationRouter(moderation),
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
    shop: new ShopService(),
  },
  new NotificationsService(),
  new ProfileService(),
  new ModerationService(),
);

export type AppRouter = typeof appRouter;
