import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  accessEmailOutbox,
  passwordTokens,
} from "../../../../packages/database/src/schema";
import type { Transaction } from "./access";

export const accessEmailNeedsScrub = () =>
  or(
    sql`LENGTH(${accessEmailOutbox.email}) > 0`,
    sql`JSON_CONTAINS_PATH(${accessEmailOutbox.payload}, 'one', '$.tokenCipher') = 1`,
    and(
      isNull(accessEmailOutbox.sentAt),
      isNull(accessEmailOutbox.discardedAt),
    ),
    isNotNull(accessEmailOutbox.leaseId),
    isNotNull(accessEmailOutbox.leaseUntil),
  );

/** Caller holds the user lock throughout both writes. */
export async function scrubAccessEmailData(tx: Transaction, userId: number) {
  const [tokens] = await tx
    .delete(passwordTokens)
    .where(eq(passwordTokens.userId, userId));
  // Preserve delivery evidence for paid orders and fence claimed messages.
  const [mail] = await tx
    .update(accessEmailOutbox)
    .set({
      email: "",
      payload: sql`JSON_REMOVE(${accessEmailOutbox.payload}, '$.tokenCipher')`,
      discardedAt: sql`CASE WHEN ${accessEmailOutbox.sentAt} IS NULL
        THEN COALESCE(${accessEmailOutbox.discardedAt}, CURRENT_TIMESTAMP)
        ELSE ${accessEmailOutbox.discardedAt} END`,
      leaseId: null,
      leaseUntil: null,
    })
    .where(and(eq(accessEmailOutbox.userId, userId), accessEmailNeedsScrub()));
  return { passwordTokens: tokens.affectedRows, mailRows: mail.affectedRows };
}
