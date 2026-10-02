import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { clubPayments, users } from "../../../../packages/database/src/schema";

export async function settleClubOrder(database: MySql2Database, input: {
  orderId: string; periodMs: number; sum?: string | null;
}): Promise<boolean> {
  const [recipient] = await database.select({ userId: clubPayments.userId })
    .from(clubPayments).where(eq(clubPayments.orderId, input.orderId)).limit(1);
  if (!recipient) return false;
  return database.transaction(async (tx) => {
    // Lock the owner before reading expiry: different payments for one member
    // must serialize as well as replays of the same payment.
    const [user] = await tx.select().from(users).where(eq(users.id, recipient.userId)).for("update");
    if (!user || user.blockedAt) return false;
    const [payment] = await tx.select().from(clubPayments)
      .where(eq(clubPayments.orderId, input.orderId)).for("update");
    if (!payment || payment.userId !== user.id) return false;
    if (payment.status === "paid") return true;
    if (payment.status !== "pending") return false;
    const [latest] = await tx.select({ expiresAt: clubPayments.expiresAt })
      .from(clubPayments).where(and(eq(clubPayments.userId, user.id), eq(clubPayments.status, "paid")))
      .orderBy(desc(clubPayments.expiresAt)).limit(1);
    const expiresAt = new Date(Math.max(Date.now(), latest?.expiresAt?.getTime() ?? 0) + input.periodMs);
    await tx.update(clubPayments).set({ status: "paid", paidAt: new Date(), expiresAt,
      sum: input.sum ?? payment.sum }).where(eq(clubPayments.id, payment.id));
    return true;
  });
}
