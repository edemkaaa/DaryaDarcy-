import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  billingCheckoutIntents,
  billingProfiles,
  billingReceipts,
  clubPayments,
  users,
} from "../../../../packages/database/src/schema";
import type { Transaction } from "../identity/access";
import {
  billingKey,
  moneyMinor,
  profileKey,
  type PaymentProof,
} from "./protocol";
export type Profile = typeof billingProfiles.$inferSelect & {
  manager?: boolean;
};

/** Expected pre-effect refusal; SQL/worker failures must remain server errors. */
export class CancellationUnavailableError extends Error {}

/** Read-only recovery after an unknown/lost cancellation response. A stored
 * request is not proof that the provider has disabled future charges.
 */
export async function readClubCancellationStatus(
  database: Pick<MySql2Database, "select">,
  userId: number,
  cancelAtPeriodEnd: boolean,
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
  return cancelAtPeriodEnd ? "confirmed" : "none";
}

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
  const remaining = await tx
    .select()
    .from(billingProfiles)
    .where(
      and(
        eq(billingProfiles.userId, userId),
        isNull(billingProfiles.cancelledAt),
      ),
    )
    .limit(1);
  if (!remaining.length)
    await tx
      .update(clubPayments)
      .set({ cancelAtPeriodEnd: true, cancelledAt: new Date() })
      .where(
        and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")),
      );
}
export async function requestClubCancellation(
  database: MySql2Database,
  userId: number,
  send: (profile: Profile) => Promise<boolean>,
): Promise<{ confirmed: boolean; expiresAt: Date | null }> {
  const expiresAt = await database.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
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
    if (!profiles.length) {
      let verifiedOneOff = false;
      if (paid.orderId.startsWith("yk-club-")) {
        const [intent] = await tx
          .select()
          .from(billingCheckoutIntents)
          .where(
            and(
              eq(billingCheckoutIntents.userId, userId),
              eq(billingCheckoutIntents.orderId, paid.orderId),
            ),
          )
          .limit(1);
        if (intent?.providerPaymentId) {
          const [receipt] = await tx
            .select()
            .from(billingReceipts)
            .where(
              and(
                eq(
                  billingReceipts.paymentKey,
                  billingKey([
                    `yookassa:test:${intent.shopId}`,
                    intent.providerPaymentId,
                  ]),
                ),
                eq(billingReceipts.userId, userId),
                eq(billingReceipts.orderId, paid.orderId),
              ),
            )
            .limit(1);
          verifiedOneOff = Boolean(
            receipt &&
            receipt.amountMinor === intent.amountMinor &&
            moneyMinor(paid.sum) === intent.amountMinor,
          );
        }
      }
      const [unboundMonthly] = await tx
        .select({ id: clubPayments.id })
        .from(clubPayments)
        .where(
          and(
            eq(clubPayments.userId, userId),
            eq(clubPayments.status, "paid"),
            like(clubPayments.orderId, "club-%"),
          ),
        )
        .limit(1);
      // Verified one-off payments have no future charges; an order prefix alone
      // is not evidence. Never hide an older unbound monthly subscription.
      if (
        unboundMonthly ||
        (!paid.orderId.startsWith("club6m-") &&
          !paid.orderId.startsWith("admin-grant-") &&
          !verifiedOneOff)
      )
        throw new CancellationUnavailableError(
          "Verified billing profile required; contact support",
        );
      await markConfirmed(tx, userId);
    } else await queueCancellationForUser(tx, userId);
    return paid.expiresAt;
  });
  await processCancellations(database, send, userId);
  const remaining = await database
    .select()
    .from(billingProfiles)
    .where(
      and(
        eq(billingProfiles.userId, userId),
        isNull(billingProfiles.cancelledAt),
      ),
    )
    .limit(1);
  return { confirmed: !remaining.length, expiresAt };
}
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
          leaseUntil: new Date(Date.now() + 60000),
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
