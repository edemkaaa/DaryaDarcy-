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
): Promise<ClubPayment | undefined> {
  const rows = await db
    .select()
    .from(clubPayments)
    .where(
      and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")),
    )
    .orderBy(desc(clubPayments.expiresAt));
  const now = Date.now();
  return rows.find(
    (row) => row.expiresAt && new Date(row.expiresAt).getTime() > now,
  );
}
