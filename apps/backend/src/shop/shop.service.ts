import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import type { User } from "../../../../packages/database/src/schema";
import * as db from "../db";
import { buildShopCheckoutUrl, getShopProduct } from "../prodamus";

/** Existing shop use cases; checkout callers enforce the release capability. */
@Injectable()
export class ShopService {
  async owned(
    actor: User | null,
    productId: string,
  ): Promise<{ owned: boolean }> {
    if (!actor) return { owned: false };
    return { owned: await db.userOwnsShopProduct(actor.id, productId) };
  }

  async createCheckout(
    actor: User,
    productId: string,
  ): Promise<{ url: string }> {
    const product = getShopProduct(productId);
    if (!product) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Товар не найден" });
    }
    const email = (actor.email || "").trim();
    if (!email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Для оплаты нужна почта в профиле",
      });
    }
    const orderId = `shop-${productId}-${randomUUID()}`;
    const url = buildShopCheckoutUrl({
      productId,
      orderId,
      email,
      userId: actor.id,
    });
    if (!url) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Не удалось создать оплату",
      });
    }
    await db.createShopPurchase(
      { userId: actor.id, productId, orderId, email },
      actor,
    );
    return { url };
  }
}
