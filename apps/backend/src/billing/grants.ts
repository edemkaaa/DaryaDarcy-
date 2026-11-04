import { lockAdminActionActor } from "../admin/action-actor";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { clubPayments, users, type User } from "../../../../packages/database/src/schema";

/** Distinct grants. Trusted maintenance may omit actor; HTTP must supply its session actor. */
export async function grantClubAccess(
  database: MySql2Database,
  userId: number,
  days: number,
  actor?: User,
): Promise<Date> {
  return database.transaction(async (tx) => {
    if (actor) await lockAdminActionActor(tx, actor, userId, "grantClub");
    return grantClubAccessInTransaction(tx, userId, days);
  });
}

export async function grantClubAccessInTransaction(
  tx: Parameters<Parameters<MySql2Database["transaction"]>[0]>[0],
  userId: number,
  days: number,
): Promise<Date> {
  const periodMs = days * 86400000;
  if (
    !Number.isSafeInteger(days) ||
    days <= 0 ||
    !Number.isSafeInteger(periodMs)
  )
    throw new RangeError(
      "Grant duration must be a positive whole number of days",
    );

  // Use the settlement/retention owner lock before computing the new expiry.
  const [user] = await tx
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!user)
    throw new TRPCError({ code: "NOT_FOUND", message: "Аккаунт не найден" });
  if (user.blockedAt || user.openId.startsWith(`deleted-${user.id}-`))
    throw new TRPCError({
      code: "CONFLICT",
      message: "Аккаунт недоступен для выдачи доступа",
    });
  const [latest] = await tx
    .select({ expiresAt: clubPayments.expiresAt })
    .from(clubPayments)
    .where(
      and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")),
    )
    .orderBy(desc(clubPayments.expiresAt))
    .limit(1);
  const expiresAt = new Date(
    Math.max(Date.now(), latest?.expiresAt?.getTime() ?? 0) + periodMs,
  );
  if (!Number.isFinite(expiresAt.getTime()))
    throw new RangeError("Grant expiry is outside the date range");
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
}
