import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { User } from "../../../../packages/database/src/schema";
import * as db from "../db";
import { cancelProdamusSubscription, CLUB_PRICE } from "../prodamus";
import { requestClubCancellation } from "./cancellation";

/** Protected adapters supply a verified user ID; helpers own durable state. */
@Injectable()
export class ClubSubscriptionService {
  async subscription(actor: User | null) {
    if (!actor || actor.blockedAt) {
      return {
        subscribed: false,
        expiresAt: null as Date | null,
        cancelAtPeriodEnd: false,
        isOwner: false,
        monthlyPrice: CLUB_PRICE,
      };
    }
    const owner = db.isOwnerAccount(actor);
    const paid = await db.getActiveClubSubscription(actor.id);
    return {
      subscribed: owner || Boolean(paid),
      expiresAt: paid?.expiresAt ?? null,
      cancelAtPeriodEnd: Boolean(paid?.cancelAtPeriodEnd),
      isOwner: owner,
      monthlyPrice: CLUB_PRICE,
    };
  }

  async claimPending(userId: number) {
    const already = await db.getActiveClubSubscription(userId);
    if (already) {
      return { granted: true as const, orderId: already.orderId };
    }
    // Compatibility read only: a checkout is never proof of paid access.
    return { granted: false as const, orderId: null };
  }

  async cancel(userId: number) {
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    let result;
    try {
      result = await requestClubCancellation(
        database,
        userId,
        cancelProdamusSubscription,
      );
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Не удалось определить подписку. Обратитесь в поддержку.",
      });
    }
    if (!result.confirmed) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Запрос отмены сохранён, но платёжная система пока не подтвердила отмену. Мы повторим попытку. До подтверждения автосписание может оставаться активным.",
      });
    }
    return { ok: true as const, expiresAt: result.expiresAt };
  }
}
