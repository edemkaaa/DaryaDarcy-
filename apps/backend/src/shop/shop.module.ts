/** Подключает прикладной сервис магазина к Nest без побочных действий при импорте. */
import { Module } from "@nestjs/common";
import { ShopService } from "./shop.service";

@Module({ providers: [ShopService], exports: [ShopService] })
export class ShopModule {}
