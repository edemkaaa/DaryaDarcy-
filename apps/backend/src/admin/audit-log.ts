import type { MySql2Database } from "drizzle-orm/mysql2";
import { adminAuditLog } from "../../../../packages/database/src/schema";
import { getDb } from "../database/connection";
type DataWriter = Pick<MySql2Database, "insert">;

export type AdminActionInput = {
  actorUserId: number;
  action: string;
  targetType: string;
  targetId?: number | null;
  details?: string | null;
};

export async function writeAdminAction(
  db: DataWriter,
  input: AdminActionInput,
): Promise<void> {
  await db.insert(adminAuditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    details: input.details ?? null,
  });
}

export async function logAdminAction(input: AdminActionInput): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await writeAdminAction(db, input);
}
