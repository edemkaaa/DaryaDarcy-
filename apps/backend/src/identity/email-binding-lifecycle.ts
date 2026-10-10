import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, asc, eq, lte, ne, or } from "drizzle-orm";
import {
  adminAuditLog,
  memberEmailBindings,
  memberEmailBindingOutbox,
  users,
} from "../../../../packages/database/src/schema";
import { EmailBindingError } from "./email-binding";

type Transaction = Parameters<Parameters<MySql2Database["transaction"]>[0]>[0];
const HISTORY_MS = 30 * 24 * 60 * 60 * 1000;

/** Caller holds the recipient and binding locks, in that order. */
export async function completeMemberEmailBinding(
  tx: Transaction,
  requestKey: string,
  state: "confirmed" | "expired" | "cancelled",
) {
  const completedAt = new Date();
  await tx
    .update(memberEmailBindings)
    .set({
      state,
      completedAt,
      email: null,
      proofHash: null,
    })
    .where(eq(memberEmailBindings.requestKey, requestKey));
  await tx
    .update(memberEmailBindingOutbox)
    .set({
      tokenCipher: null,
      discardedAt: completedAt,
      lastError: `binding_${state}`,
      leaseId: null,
      leaseUntil: null,
    })
    .where(eq(memberEmailBindingOutbox.requestKey, requestKey));
}

/** Internal bounded maintenance; not registered until the binding schema rollout. */
export async function maintainMemberEmailBindings(
  database: MySql2Database,
  limit = 100,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new EmailBindingError("invalid_input");
  const result = { expired: 0, purged: 0 };
  try {
    const now = new Date();
    const candidates = await database
      .select({
        requestKey: memberEmailBindings.requestKey,
        userId: memberEmailBindings.userId,
      })
      .from(memberEmailBindings)
      .where(
        or(
          and(
            eq(memberEmailBindings.state, "pending"),
            lte(memberEmailBindings.expiresAt, now),
          ),
          and(
            ne(memberEmailBindings.state, "pending"),
            lte(
              memberEmailBindings.completedAt,
              new Date(now.getTime() - HISTORY_MS),
            ),
          ),
        ),
      )
      .orderBy(
        asc(memberEmailBindings.createdAt),
        asc(memberEmailBindings.requestKey),
      )
      .limit(limit);
    for (const candidate of candidates) {
      const outcome = await database.transaction(async (tx) => {
        // Serialize with requests, confirmation and account deletion. Candidate
        // reads are only routing hints; never act on their pre-lock state.
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, candidate.userId))
          .for("update");
        const [binding] = await tx
          .select()
          .from(memberEmailBindings)
          .where(eq(memberEmailBindings.requestKey, candidate.requestKey))
          .for("update");
        if (!binding || binding.userId !== candidate.userId) return null;
        if (binding.state === "pending") {
          if (binding.expiresAt.getTime() > Date.now()) return null;
          await completeMemberEmailBinding(tx, binding.requestKey, "expired");
          await tx.insert(adminAuditLog).values({
            actorUserId: binding.actorUserId,
            action: "expire_member_email_binding",
            targetType: "user",
            targetId: binding.userId,
          });
          return "expired" as const;
        }
        if (
          !binding.completedAt ||
          binding.completedAt.getTime() > Date.now() - HISTORY_MS
        )
          return null;
        await tx
          .delete(memberEmailBindingOutbox)
          .where(eq(memberEmailBindingOutbox.requestKey, binding.requestKey));
        await tx
          .delete(memberEmailBindings)
          .where(eq(memberEmailBindings.requestKey, binding.requestKey));
        return "purged" as const;
      });
      if (outcome) result[outcome] += 1;
    }
    return result;
  } catch {
    // SQL parameters may contain proof/email material. Expose no driver cause.
    throw new EmailBindingError("unavailable");
  }
}
