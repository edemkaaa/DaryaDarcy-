import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { IdentityModule } from "../identity/identity.module";
import { BillingModule } from "../billing/billing.module";
import { TrpcService } from "./trpc.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { ProfileModule } from "../profile/profile.module";
import { ModerationModule } from "../moderation/moderation.module";

@Module({
  imports: [
    ContentModule,
    IdentityModule,
    BillingModule,
    NotificationsModule,
    ProfileModule,
    ModerationModule,
  ],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
