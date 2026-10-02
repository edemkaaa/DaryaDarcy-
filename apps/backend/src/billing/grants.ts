import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { clubPayments, users } from "../../../../packages/database/src/schema";

/** Each call is a distinct admin grant, not an idempotent retry of an HTTP intent. */
export async function grantClubAccess(
  database: MySql2Database,
  userId: number,
  days: number,
): Promise<Date> {
  const periodMs = days * 86400000;
  if (!Number.isSafeInteger(days) || days <= 0 || !Number.isSafeInteger(periodMs))
    throw new RangeError("Grant duration must be a positive whole number of days");

  return database.transaction(async tx => {
    // Use the settlement/retention owner lock before computing the new expiry.
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.blockedAt || user.openId.startsWith(`deleted-${user.id}-`))
      throw new Error("Аккаунт недоступен для выдачи доступа");
    const [latest] = await tx.select({ expiresAt: clubPayments.expiresAt })
      .from(clubPayments)
      .where(and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")))
      .orderBy(desc(clubPayments.expiresAt)).limit(1);
    const expiresAt = new Date(Math.max(Date.now(), latest?.expiresAt?.getTime() ?? 0) + periodMs);
    if (!Number.isFinite(expiresAt.getTime())) throw new RangeError("Grant expiry is outside the date range");
    await tx.insert(clubPayments).values({
      userId,
      orderId: `admin-grant-${userId}-${randomUUID()}`,
      email: user.email,
      sum: "0",
      status: "paid",
      paidAt: new Date(),
      expiresAt,
      cancelAtPeriodEnd: false,
    });
    return expiresAt;
  });
}
