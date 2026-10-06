import { Module } from "@nestjs/common";
import { ClubCheckoutService } from "./club-checkout.service";

@Module({ providers: [ClubCheckoutService], exports: [ClubCheckoutService] })
export class BillingModule {}
