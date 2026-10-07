import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { IdentityModule } from "../identity/identity.module";
import { BillingModule } from "../billing/billing.module";
import { TrpcService } from "./trpc.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [ContentModule, IdentityModule, BillingModule, NotificationsModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
