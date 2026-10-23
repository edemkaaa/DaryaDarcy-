import { TRPCError } from "@trpc/server";
import { asc, inArray } from "drizzle-orm";
import { users } from "../../../../packages/database/src/schema";
import type { getDb } from "../db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Lock in ID order; roles may have changed since the request authenticated. */
export async function lockUserModerationTarget(
  tx: Transaction,
  actorId: number,
  targetId: number,
) {
  const rows = await tx
    .select({
      id: users.id,
      role: users.role,
      blockedAt: users.blockedAt,
      deletingAt: users.accountDeletionRequestedAt,
    })
    .from(users)
    .where(inArray(users.id, [actorId, targetId]))
    .orderBy(asc(users.id))
    .for("update");
  const actor = rows.find((row) => row.id === actorId);
  if (
    !actor ||
    actor.blockedAt ||
    actor.deletingAt ||
    !["admin", "moderator"].includes(actor.role) ||
    actorId === targetId
  )
    throw new TRPCError({ code: "FORBIDDEN" });
  const target = rows.find((row) => row.id === targetId);
  if (!target)
    throw new TRPCError({ code: "NOT_FOUND", message: "Аккаунт не найден" });
  if (actor.role === "moderator" && target.role !== "user")
    throw new TRPCError({ code: "FORBIDDEN" });
}
