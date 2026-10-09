import { desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { clubPayments, users } from "../../../../packages/database/src/schema";

// The compatibility facade owns the lazy connection; this module only reads it.
type Database = MySql2Database | null;

export async function listAdminMembers(db: Database) {
  if (!db) throw new Error("Database not available");
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      blockedAt: users.blockedAt,
      blockedReason: users.blockedReason,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  const payments = await db
    .select()
    .from(clubPayments)
    .where(eq(clubPayments.status, "paid"));
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

export async function listAdminPayments(db: Database, limit = 50) {
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(clubPayments)
    .orderBy(desc(clubPayments.createdAt))
    .limit(limit);
}
