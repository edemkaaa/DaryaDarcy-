import { Module } from "@nestjs/common";
import { ShopService } from "./shop.service";

@Module({ providers: [ShopService], exports: [ShopService] })
export class ShopModule {}
