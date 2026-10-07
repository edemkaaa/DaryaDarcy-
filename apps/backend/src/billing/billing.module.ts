import { Module } from "@nestjs/common";
import { ClubCheckoutService } from "./club-checkout.service";
import { ClubSubscriptionService } from "./club-subscription.service";
import { handleProdamusWebhook } from "../prodamus";
import {
  PRODAMUS_WEBHOOK_HANDLER,
  ProdamusWebhookController,
  type ProdamusWebhookHandler,
} from "./prodamus-webhook.controller";

export type ClubBillingServices = {
  readonly checkout: ClubCheckoutService;
  readonly subscriptions: ClubSubscriptionService;
};

@Module({
  controllers: [ProdamusWebhookController],
  providers: [
    ClubCheckoutService,
    ClubSubscriptionService,
    {
      provide: PRODAMUS_WEBHOOK_HANDLER,
      // Allocate the binding per application, not as mutable process-global state.
      useFactory: (): ProdamusWebhookHandler => ({
        handle: handleProdamusWebhook,
      }),
    },
  ],
  exports: [ClubCheckoutService, ClubSubscriptionService],
})
export class BillingModule {}
