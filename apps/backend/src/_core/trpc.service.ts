/** Собирает дерево tRPC-процедур из сервисов приложения без глобального поиска Nest-провайдеров. */
import { Inject, Injectable } from "@nestjs/common";
import { ContentReadService } from "../content/content-read.service";
import { ContentWriteService } from "../content/content-write.service";
import { ContentCommentService } from "../content/content-comment.service";
import { ContentUploadService } from "../content/content-upload.service";
import { SessionService } from "../identity/session.service";
import { ClubCheckoutService } from "../billing/club-checkout.service";
import { ClubSubscriptionService } from "../billing/club-subscription.service";
import { createAppRouter, type AppRouter } from "../routers";
import { createContextFactory } from "./context";
import { NotificationsService } from "../notifications/notifications.service";
import { ProfileService } from "../profile/profile.service";
import { ModerationService } from "../moderation/moderation.service";
import { ShopService } from "../shop/shop.service";

/** Композиция принадлежит приложению; доменные сервисы не ищут Nest-провайдеры глобально. */
@Injectable()
export class TrpcService {
  readonly router: AppRouter;
  readonly createContext: ReturnType<typeof createContextFactory>;

  /** Принимает доменные сервисы Nest и связывает с ними router/context данного приложения без глобального service locator. */
  constructor(
    @Inject(ContentReadService) content: ContentReadService,
    @Inject(ContentWriteService) posts: ContentWriteService,
    @Inject(ContentCommentService) comments: ContentCommentService,
    @Inject(ContentUploadService) uploads: ContentUploadService,
    @Inject(ClubCheckoutService) checkout: ClubCheckoutService,
    @Inject(ClubSubscriptionService) subscriptions: ClubSubscriptionService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(NotificationsService) notifications: NotificationsService,
    @Inject(ProfileService) profiles: ProfileService,
    @Inject(ModerationService) moderation: ModerationService,
    @Inject(ShopService) shop: ShopService,
  ) {
    this.createContext = createContextFactory(this.sessions);
    this.router = createAppRouter(
      content,
      posts,
      comments,
      uploads,
      { checkout, subscriptions, shop },
      notifications,
      profiles,
      moderation,
      this.sessions,
    );
  }
}
