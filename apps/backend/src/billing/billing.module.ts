import { Module } from "@nestjs/common";
import { ClubCheckoutService } from "./club-checkout.service";
import { ClubSubscriptionService } from "./club-subscription.service";
import { ClubSettlementService } from "./club-settlement.service";
import { ClubCancellationService } from "./club-cancellation.service";
import { confirmProviderCancellation } from "./cancellation";
import * as db from "../db";
import type { ShopService } from "../shop/shop.service";
import { YookassaClubService } from "./yookassa/club.service";
import { YookassaWebhookController } from "./yookassa/webhook.controller";
import { createProdamusWebhookHandler } from "../prodamus";
import { ProdamusSandboxService } from "./prodamus-sandbox.service";
import { ProdamusSandboxController } from "./prodamus-sandbox.controller";
import { ProdamusTestClubController } from "./prodamus-test-club.controller";
import {
  PRODAMUS_WEBHOOK_HANDLER,
  ProdamusWebhookController,
  type ProdamusWebhookHandler,
} from "./prodamus-webhook.controller";

export type ClubBillingServices = {
  readonly checkout: Pick<
    ClubCheckoutService,
    "createCheckout" | "reconcileCheckout"
  >;
  readonly subscriptions: ClubSubscriptionService;
};

export type BillingServices = ClubBillingServices & {
  readonly shop: Pick<ShopService, "owned" | "createCheckout">;
};

@Module({
  controllers: [
    ProdamusWebhookController,
    YookassaWebhookController,
    ProdamusSandboxController,
    ProdamusTestClubController,
  ],
  providers: [
    {
      provide: ProdamusSandboxService,
      useFactory: () => new ProdamusSandboxService(process.env),
    },
    YookassaClubService,
    {
      provide: ClubCheckoutService,
      useFactory: (yookassa: YookassaClubService) =>
        new ClubCheckoutService(yookassa),
      inject: [YookassaClubService],
    },
    ClubSubscriptionService,
    {
      provide: ClubCancellationService,
      useFactory: () =>
        new ClubCancellationService({
          getDb: () => db.getDb(),
          confirm: (database, profile) =>
            confirmProviderCancellation(database, profile),
        }),
    },
    {
      provide: ClubSettlementService,
      useFactory: () =>
        new ClubSettlementService((input) => db.settleClubPayment(input)),
    },
    {
      provide: PRODAMUS_WEBHOOK_HANDLER,
      // Allocate the binding per application, not as mutable process-global state.
      useFactory: (
        settlement: ClubSettlementService,
        cancellation: ClubCancellationService,
      ): ProdamusWebhookHandler => ({
        handle: createProdamusWebhookHandler(settlement, cancellation),
      }),
      inject: [ClubSettlementService, ClubCancellationService],
    },
  ],
  exports: [ClubCheckoutService, ClubSubscriptionService],
})
export class BillingModule {}
