/** Хранит запрос отмены, повторяет внешнюю отмену по lease и отдельно фиксирует подтверждение провайдера. */
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  and,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  billingProfiles,
  clubPayments,
  users,
  type ClubPayment,
  type User,
} from "../../../../packages/database/src/schema";
import type { Transaction } from "../identity/access";
import {
  hasUnboundMonthlyPayment,
  supportsCancellationPayment,
} from "./cancellation-evidence";
import { profileKey, type PaymentProof } from "./protocol";
export type Profile = typeof billingProfiles.$inferSelect & {
  manager?: boolean;
};

/** Ожидаемый отказ до внешнего эффекта; ошибки SQL/worker должны оставаться серверными. */
export class CancellationUnavailableError extends Error {}

export type CancellationActor = Pick<User, "id" | "openId" | "sessionVersion">;
export class CancellationActorError extends Error {
  constructor(readonly code: "UNAUTHORIZED" | "FORBIDDEN") {
    super(code);
  }
}

/** Восстанавливает результат неизвестного ответа отмены только чтением.
 * Записанный запрос не доказывает отключение будущих списаний у провайдера.
 */
export async function readClubCancellationStatus(
  database: Pick<MySql2Database, "select">,
  userId: number,
  paid: ClubPayment | undefined,
): Promise<"none" | "pending" | "confirmed"> {
  const pending = await database
    .select({ profileKey: billingProfiles.profileKey })
    .from(billingProfiles)
    .where(
      and(
        eq(billingProfiles.userId, userId),
        isNotNull(billingProfiles.cancelRequestedAt),
        isNull(billingProfiles.cancelledAt),
      ),
    )
    .limit(1);
  if (pending.length) return "pending";
  if (!paid?.cancelAtPeriodEnd) return "none";
  const profiles = await database
    .select()
    .from(billingProfiles)
    .where(eq(billingProfiles.userId, userId));
  return !profiles.some((profile) => !profile.cancelledAt) &&
    (await supportsCancellationPayment(database, paid)) &&
    !(await hasUnboundMonthlyPayment(database, userId, profiles))
    ? "confirmed"
    : "none";
}

/** Записывает намерение отмены, но не выставляет подтверждённое прекращение будущих списаний. */
export async function queueCancellationForUser(
  tx: Transaction,
  userId: number,
) {
  await tx
    .update(billingProfiles)
    .set({
      cancelRequestedAt: sql`CURRENT_TIMESTAMP`,
      nextAttemptAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(
      and(
        eq(billingProfiles.userId, userId),
        isNull(billingProfiles.cancelRequestedAt),
        isNull(billingProfiles.cancelledAt),
      ),
    );
}
async function markConfirmed(tx: Transaction, userId: number) {
  const profiles = await tx
    .select()
    .from(billingProfiles)
    .where(eq(billingProfiles.userId, userId));
  if (
    profiles.some((profile) => !profile.cancelledAt) ||
    (await hasUnboundMonthlyPayment(tx, userId, profiles))
  )
    return;
  await markPaidPeriodConfirmed(tx, userId);
}

async function markPaidPeriodConfirmed(tx: Transaction, userId: number) {
  await tx
    .update(clubPayments)
    .set({ cancelAtPeriodEnd: true, cancelledAt: new Date() })
    .where(
      and(
        eq(clubPayments.userId, userId),
        eq(clubPayments.status, "paid"),
        eq(clubPayments.cancelAtPeriodEnd, false),
      ),
    );
}

/** Сначала фиксирует запрос, затем пытается связаться с провайдером и перечитывает итоговое состояние. */
export async function requestClubCancellation(
  database: MySql2Database,
  owner: number | CancellationActor,
  send: (profile: Profile) => Promise<boolean>,
): Promise<{ confirmed: boolean; expiresAt: Date | null }> {
  const userId = typeof owner === "number" ? owner : owner.id;
  const paid = await database.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (typeof owner !== "number") {
      if (
        !user ||
        user.openId !== owner.openId ||
        user.sessionVersion !== owner.sessionVersion
      )
        throw new CancellationActorError("UNAUTHORIZED");
      if (user.blockedAt) throw new CancellationActorError("FORBIDDEN");
    }
    if (!user || user.blockedAt)
      throw new CancellationUnavailableError("Account unavailable");
    const [paid] = await tx
      .select()
      .from(clubPayments)
      .where(
        and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")),
      )
      .orderBy(desc(clubPayments.expiresAt))
      .limit(1);
    if (!paid) throw new CancellationUnavailableError("No paid subscription");
    const profiles = await tx
      .select()
      .from(billingProfiles)
      .where(eq(billingProfiles.userId, userId))
      .for("update");
    if (
      !(await supportsCancellationPayment(tx, paid)) ||
      (await hasUnboundMonthlyPayment(tx, userId, profiles))
    )
      throw new CancellationUnavailableError(
        "Verified billing profile required; contact support",
      );
    if (profiles.some((profile) => !profile.cancelledAt))
      await queueCancellationForUser(tx, userId);
    else await markPaidPeriodConfirmed(tx, userId);
    return paid;
  });
  await processCancellations(database, send, userId);
  const confirmed = await database.transaction(
    async (tx) => {
      const [current] = await tx
        .select()
        .from(clubPayments)
        .where(
          and(
            eq(clubPayments.id, paid.id),
            eq(clubPayments.userId, userId),
            eq(clubPayments.status, "paid"),
          ),
        );
      return (
        (await readClubCancellationStatus(tx, userId, current)) === "confirmed"
      );
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return { confirmed, expiresAt: paid.expiresAt };
}

/** Только подтверждение провайдера завершает профиль и согласует оплаченный период пользователя. */
export async function confirmProviderCancellation(
  database: MySql2Database,
  proof: Pick<PaymentProof, "domain" | "subscriptionId" | "profileId">,
): Promise<boolean> {
  const key = profileKey(proof);
  const [profile] = await database
    .select()
    .from(billingProfiles)
    .where(eq(billingProfiles.profileKey, key));
  if (!profile) return false;
  return database.transaction(async (tx) => {
    await tx
      .select()
      .from(users)
      .where(eq(users.id, profile.userId))
      .for("update");
    await tx
      .update(billingProfiles)
      .set({
        cancelRequestedAt: profile.cancelRequestedAt || new Date(),
        cancelledAt: new Date(),
        leaseId: null,
        leaseUntil: null,
      })
      .where(eq(billingProfiles.profileKey, key));
    await markConfirmed(tx, profile.userId);
    return true;
  });
}
/** Ограниченные повторы по lease; поздний ответ не должен перезаписать работу заменяющего worker. */
export async function processCancellations(
  database: MySql2Database,
  send: (profile: Profile) => Promise<boolean>,
  userId?: number,
): Promise<void> {
  for (let batch = 0; batch < 20; batch++) {
    const leaseId = randomUUID();
    const profile = await database.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(billingProfiles)
        .where(
          and(
            userId === undefined
              ? undefined
              : eq(billingProfiles.userId, userId),
            isNotNull(billingProfiles.cancelRequestedAt),
            isNull(billingProfiles.cancelledAt),
            lte(billingProfiles.nextAttemptAt, sql`CURRENT_TIMESTAMP`),
            or(
              isNull(billingProfiles.leaseUntil),
              lte(billingProfiles.leaseUntil, sql`CURRENT_TIMESTAMP`),
            ),
          ),
        )
        .orderBy(billingProfiles.profileKey)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      await tx
        .update(billingProfiles)
        .set({
          leaseId,
          leaseUntil: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE)`,
          attempts: row.attempts + 1,
        })
        .where(eq(billingProfiles.profileKey, row.profileKey));
      return row;
    });
    if (!profile) return;
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, profile.userId));
    let success = false;
    try {
      // Финальная запись уже сравнивает leaseId, но и внешний запрос запрещён,
      // если worker потерял владение во время чтения actor.
      const [owned] = await database
        .select({ profileKey: billingProfiles.profileKey })
        .from(billingProfiles)
        .where(
          and(
            eq(billingProfiles.profileKey, profile.profileKey),
            eq(billingProfiles.leaseId, leaseId),
            gt(billingProfiles.leaseUntil, sql`CURRENT_TIMESTAMP`),
            isNotNull(billingProfiles.cancelRequestedAt),
            isNull(billingProfiles.cancelledAt),
          ),
        )
        .limit(1);
      if (!owned) continue;
      success = await send({ ...profile, manager: Boolean(user?.blockedAt) });
    } catch {
      success = false;
    }
    await database.transaction(async (tx) => {
      await tx
        .select()
        .from(users)
        .where(eq(users.id, profile.userId))
        .for("update");
      const [current] = await tx
        .select()
        .from(billingProfiles)
        .where(eq(billingProfiles.profileKey, profile.profileKey))
        .for("update");
      if (!current || current.leaseId !== leaseId) return;
      await tx
        .update(billingProfiles)
        .set(
          success
            ? { cancelledAt: new Date(), leaseId: null, leaseUntil: null }
            : {
                leaseId: null,
                leaseUntil: null,
                nextAttemptAt: new Date(
                  Date.now() +
                    Math.min(
                      86400000,
                      60000 * 2 ** Math.min(profile.attempts, 10),
                    ),
                ),
              },
        )
        .where(eq(billingProfiles.profileKey, profile.profileKey));
      if (success) await markConfirmed(tx, profile.userId);
    });
  }
}
