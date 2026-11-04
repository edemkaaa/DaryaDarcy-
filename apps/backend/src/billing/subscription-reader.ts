import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  clubPayments,
  type ClubPayment,
} from "../../../../packages/database/src/schema";

/** Read on the supplied pool/transaction, never reacquire the global database. */
export async function readActiveClubSubscription(
  db: Pick<MySql2Database, "select">,
  userId: number,
  lockMode?: "share",
): Promise<ClubPayment | undefined> {
  const query = db
    .select()
    .from(clubPayments)
    .where(
      and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")),
    )
    .orderBy(desc(clubPayments.expiresAt));
  // Locked reads observe current access even after an earlier snapshot read.
  const rows = await (lockMode ? query.for(lockMode) : query);
  const now = Date.now();
  return rows.find(
    (row) => row.expiresAt && new Date(row.expiresAt).getTime() > now,
  );
}
