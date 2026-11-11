/** Пользовательские операции с подпиской: её состояние, отмена и явные результаты ожидания. */
import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { User } from "../../../../packages/database/src/schema";
import * as db from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { cancelProdamusSubscription, CLUB_PRICE } from "../prodamus";
import {
  CancellationActorError,
  CancellationUnavailableError,
  type CancellationActor,
  readClubCancellationStatus,
  requestClubCancellation,
} from "./cancellation";

/** Защищённый адаптер передаёт actor; долговечным состоянием владеют доменные helpers. */
@Injectable()
export class ClubSubscriptionService {
  /** Возвращает guest-ответ без доступа либо читает paid-период и отмену одним snapshot, затем применяет общую club-policy. */
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
    // Флаги оплаченного периода и pending-профили читаются одним snapshot.
    // Иначе подтверждение worker между чтениями могло бы создать ложное "none".
    const { paid, cancellationStatus } = await database.transaction(
      async (tx) => {
        const paid = await db.getActiveClubSubscription(actor.id, tx);
        return {
          paid,
          cancellationStatus: await readClubCancellationStatus(
            tx,
            actor.id,
            paid,
          ),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    return {
      hasClubAccess: await userHasClubAccess(actor, async () => paid),
      subscribed: owner || Boolean(paid),
      expiresAt: paid?.expiresAt ?? null,
      cancelAtPeriodEnd: cancellationStatus === "confirmed",
      cancellationStatus,
      isOwner: owner,
      monthlyPrice: CLUB_PRICE,
    };
  }

  /** Совместимое чтение возвращает granted только для уже действующего paid-доступа; сам pending-checkout ничего не выдаёт. */
  async claimPending(userId: number) {
    const already = await db.getActiveClubSubscription(userId);
    if (already) {
      return { granted: true as const, orderId: already.orderId };
    }
    // Compatibility read only: a checkout is never proof of paid access.
    return { granted: false as const, orderId: null };
  }

  /** Сохраняет запрос отмены, возвращает pending/confirmed и expiresAt; инфраструктурный сбой не превращается в окончательный бизнес-отказ. */
  async cancel(actor: CancellationActor): Promise<{
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
        actor,
        cancelProdamusSubscription,
      );
    } catch (error) {
      if (error instanceof CancellationActorError)
        throw new TRPCError({ code: error.code });
      // При сбое worker/SQL запрос уже мог быть зафиксирован.
      // Неизвестный результат нельзя превращать в окончательный отказ клиента.
      if (!(error instanceof CancellationUnavailableError))
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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
