import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { requireCapability } from "../launch/capabilities";
import { ShopService } from "./shop.service";

export const createShopRouter = (
  shop: Pick<ShopService, "owned" | "createCheckout">,
) =>
  router({
    owned: publicProcedure
      .input(z.object({ productId: z.string() }))
      .query(({ ctx, input }) => shop.owned(ctx.user, input.productId)),
    createCheckout: protectedProcedure
      .input(z.object({ productId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        requireCapability("shopOnlinePayment");
        return shop.createCheckout(ctx.user, input.productId);
      }),
  });

// Standalone callers share the implementation; HTTP supplies Nest's instance.
export const shopRouter = createShopRouter(new ShopService());
