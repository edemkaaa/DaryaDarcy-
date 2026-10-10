import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import {
  memberEmailBindings,
  memberEmailBindingOutbox,
  users,
} from "../../../../packages/database/src/schema";
import {
  EmailBindingError,
  emailBindingActorSchema,
  emailBindingRequestKeySchema,
  type EmailBindingActor,
  type EmailBindingReceipt,
} from "./email-binding";

export type EmailBindingStatus = EmailBindingReceipt & {
  userId: number;
  delivery: "queued" | "sent" | "unavailable";
  expiresAt: string;
  completedAt: string | null;
};

/** Read-only recovery; the receipt never includes an address, proof or cipher. */
export async function getMemberEmailBindingStatus(
  database: MySql2Database,
  actor: EmailBindingActor,
  requestKey: string,
): Promise<EmailBindingStatus | null> {
  const principal = emailBindingActorSchema.safeParse(actor);
  const key = emailBindingRequestKeySchema.safeParse(requestKey);
  if (!principal.success || !key.success)
    throw new EmailBindingError("invalid_input");
  try {
    return await database.transaction(async (tx) => {
      // Locking read waits for a concurrent revocation; ordinary MVCC could
      // otherwise report a receipt using the administrator's previous role.
      const [administrator] = await tx
        .select({
          role: users.role,
          sessionVersion: users.sessionVersion,
          blockedAt: users.blockedAt,
          deleting: users.accountDeletionRequestedAt,
          openId: users.openId,
        })
        .from(users)
        .where(eq(users.id, principal.data.userId))
        .for("share");
      if (
        !administrator ||
        administrator.role !== "admin" ||
        administrator.sessionVersion !== principal.data.sessionVersion ||
        administrator.blockedAt ||
        administrator.deleting ||
        administrator.openId.startsWith("deleted-")
      )
        throw new EmailBindingError("forbidden");

      // A single snapshot keeps lifecycle and delivery mutually consistent;
      // no binding/outbox locks or maintenance writes are needed for inspection.
      const [binding] = await tx
        .select({
          requestKey: memberEmailBindings.requestKey,
          userId: memberEmailBindings.userId,
          state: memberEmailBindings.state,
          expiresAt: memberEmailBindings.expiresAt,
          completedAt: memberEmailBindings.completedAt,
          sentAt: memberEmailBindingOutbox.sentAt,
          canDeliver: sql<number>`(${memberEmailBindings.state} = 'pending'
          AND ${memberEmailBindings.expiresAt} > CURRENT_TIMESTAMP
          AND ${memberEmailBindingOutbox.discardedAt} IS NULL
          AND ${memberEmailBindingOutbox.tokenCipher} IS NOT NULL)`,
        })
        .from(memberEmailBindings)
        .leftJoin(
          memberEmailBindingOutbox,
          eq(
            memberEmailBindingOutbox.requestKey,
            memberEmailBindings.requestKey,
          ),
        )
        .where(eq(memberEmailBindings.requestKey, key.data))
        .limit(1);
      if (!binding) return null;
      return {
        requestKey: binding.requestKey,
        userId: binding.userId,
        state: binding.state,
        delivery: binding.sentAt
          ? "sent"
          : binding.canDeliver
            ? "queued"
            : "unavailable",
        expiresAt: binding.expiresAt.toISOString(),
        completedAt: binding.completedAt?.toISOString() ?? null,
      };
    });
  } catch (error) {
    if (error instanceof EmailBindingError) throw error;
    throw new EmailBindingError("unavailable");
  }
}
