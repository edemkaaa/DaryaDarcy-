import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { requireCapability } from "../launch/capabilities";
import { buildShopCheckoutUrl, getShopProduct } from "../prodamus";

export const shopRouter = router({
  owned: publicProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return { owned: false };
      return {
        owned: await db.userOwnsShopProduct(ctx.user.id, input.productId),
      };
    }),
  createCheckout: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireCapability("shopOnlinePayment");
      const product = getShopProduct(input.productId);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Товар не найден" });
      }
      const email = (ctx.user.email || "").trim();
      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Для оплаты нужна почта в профиле",
        });
      }
      const orderId = `shop-${input.productId}-${randomUUID()}`;
      await db.createShopPurchase({
        userId: ctx.user.id,
        productId: input.productId,
        orderId,
        email,
      });
      const url = buildShopCheckoutUrl({
        productId: input.productId,
        orderId,
        email,
        userId: ctx.user.id,
      });
      if (!url) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Не удалось создать оплату",
        });
      }
      return { url };
    }),
});
