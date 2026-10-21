import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { User } from "../../../../packages/database/src/schema";
import * as db from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { cancelProdamusSubscription, CLUB_PRICE } from "../prodamus";
import {
  readClubCancellationStatus,
  requestClubCancellation,
} from "./cancellation";

/** Protected adapters supply a verified user ID; helpers own durable state. */
@Injectable()
export class ClubSubscriptionService {
  async subscription(actor: User | null) {
    if (!actor || actor.blockedAt) {
      return {
        hasClubAccess: false,
        subscribed: false,
        expiresAt: null as Date | null,
        cancelAtPeriodEnd: false,
        cancellationStatus: "none" as const,
        isOwner: false,
        monthlyPrice: CLUB_PRICE,
      };
    }
    const owner = db.isOwnerAccount(actor);
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Paid flags and pending profiles must describe the same read snapshot.
    // Otherwise a worker confirming between the two reads can fabricate "none".
    const { paid, cancellationStatus } = await database.transaction(
      async (tx) => {
        const paid = await db.getActiveClubSubscription(actor.id, tx);
        return {
          paid,
          cancellationStatus: await readClubCancellationStatus(
            tx,
            actor.id,
            Boolean(paid?.cancelAtPeriodEnd),
          ),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    return {
      hasClubAccess: await userHasClubAccess(actor, async () => paid),
      subscribed: owner || Boolean(paid),
      expiresAt: paid?.expiresAt ?? null,
      cancelAtPeriodEnd: Boolean(paid?.cancelAtPeriodEnd),
      cancellationStatus,
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

  async cancel(userId: number): Promise<{
    ok: true;
    cancellationStatus: "pending" | "confirmed";
    expiresAt: Date | null;
    message: string;
  }> {
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
    return {
      ok: true,
      cancellationStatus: result.confirmed ? "confirmed" : "pending",
      expiresAt: result.expiresAt,
      message: result.confirmed
        ? "Отмена подтверждена. Доступ к клубу сохранён до конца оплаченного периода."
        : "Запрос отмены сохранён, но платёжная система пока не подтвердила отмену. Мы повторим попытку. До подтверждения автосписание может оставаться активным.",
    };
  }
}
