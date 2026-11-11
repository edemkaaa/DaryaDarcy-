/** Совместимые чтения участников и оплат из переданного клиента БД. */
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { clubPayments, users } from "../../../../packages/database/src/schema";
import { boundedLegacyList, LEGACY_LIST_CAP } from "../content/legacy-list-limit";

// The compatibility facade owns the lazy connection; this module only reads it.
type Database = MySql2Database | null;

/** Читаем административную проекцию участников через переданный клиент БД. */
export async function listAdminMembers(db: Database) {
  if (!db) throw new Error("Database not available");
  const allUsers = boundedLegacyList(await db
    .select({
      id: users.id,
      email: users.email,
      contactPhone: users.contactPhone,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      blockedAt: users.blockedAt,
      blockedReason: users.blockedReason,
    })
    .from(users)
    .orderBy(desc(users.createdAt)).limit(LEGACY_LIST_CAP + 1));
  if (!allUsers.length) return [];
  const payments = await db
    .select({ userId: clubPayments.userId, expiresAt: sql<string>`MAX(${clubPayments.expiresAt})`.mapWith(clubPayments.expiresAt) })
    .from(clubPayments)
    .where(and(eq(clubPayments.status, "paid"), gt(clubPayments.expiresAt, new Date()), inArray(clubPayments.userId, allUsers.map(user => user.id))))
    .groupBy(clubPayments.userId);
  const now = Date.now();
  const expiresByUser = new Map<number, Date>();
  for (const row of payments) {
    if (!row.expiresAt) continue;
    if (new Date(row.expiresAt).getTime() <= now) continue;
    const current = expiresByUser.get(row.userId);
    if (!current || new Date(row.expiresAt) > current) {
      expiresByUser.set(row.userId, new Date(row.expiresAt));
    }
  }
  return allUsers.map((user) => ({
    ...user,
    clubExpiresAt: expiresByUser.get(user.id) ?? null,
  }));
}

/** Чтение истории не вызывает провайдера и не меняет оплаченный срок. */
export async function listAdminPayments(db: Database, limit = 50) {
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(clubPayments)
    .orderBy(desc(clubPayments.createdAt))
    .limit(limit);
}
