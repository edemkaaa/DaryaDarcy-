import { Module } from "@nestjs/common";
import { ClubCheckoutService } from "./club-checkout.service";
import { ClubSubscriptionService } from "./club-subscription.service";

export type ClubBillingServices = {
  readonly checkout: ClubCheckoutService;
  readonly subscriptions: ClubSubscriptionService;
};

@Module({
  providers: [ClubCheckoutService, ClubSubscriptionService],
  exports: [ClubCheckoutService, ClubSubscriptionService],
})
export class BillingModule {}
