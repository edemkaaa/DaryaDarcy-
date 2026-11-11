/** Правила выбора цели модерации и согласованный порядок блокировки actor и target. */
import type { ContentWriteActor } from "../content/content-write-actor";
import { TRPCError } from "@trpc/server";
import { asc, inArray } from "drizzle-orm";
import { users, type User } from "../../../../packages/database/src/schema";
import type { getDb } from "../db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type ModerationActor = Pick<
  User,
  "id" | "role" | "blockedAt" | "accountDeletionRequestedAt"
>;

export function canModerateUserTarget(
  actor: ModerationActor | undefined,
  target: Pick<User, "id" | "role"> | undefined,
): boolean {
  return Boolean(
    actor &&
    target &&
    !actor.blockedAt &&
    !actor.accountDeletionRequestedAt &&
    actor.id !== target.id &&
    (actor.role === "admin" ||
      (actor.role === "moderator" && target.role === "user")),
  );
}

/** Блокируем по ID: роли могли измениться после аутентификации HTTP-запроса. */
export async function lockUserModerationTarget(
  tx: Transaction,
  requestActor: ContentWriteActor,
  targetId: number,
) {
  const rows = await tx
    .select({
      id: users.id,
      role: users.role,
      sessionVersion: users.sessionVersion,
      blockedAt: users.blockedAt,
      accountDeletionRequestedAt: users.accountDeletionRequestedAt,
    })
    .from(users)
    .where(inArray(users.id, [requestActor.id, targetId]))
    .orderBy(asc(users.id))
    .for("update");
  const actor = rows.find((row) => row.id === requestActor.id);
  if (!actor || actor.sessionVersion !== requestActor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (
    actor.blockedAt ||
    actor.accountDeletionRequestedAt ||
    !["admin", "moderator"].includes(actor.role) ||
    requestActor.id === targetId
  )
    throw new TRPCError({ code: "FORBIDDEN" });
  const target = rows.find((row) => row.id === targetId);
  if (!target)
    throw new TRPCError({ code: "NOT_FOUND", message: "Аккаунт не найден" });
  if (!canModerateUserTarget(actor, target))
    throw new TRPCError({ code: "FORBIDDEN" });
}
