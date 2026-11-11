/** Актуальность администратора и целевого пользователя проверяется под согласованными блокировками. */
import { TRPCError } from "@trpc/server";
import { asc, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { users, type User } from "../../../../packages/database/src/schema";
import type { AdminActionKind } from "../../../../packages/shared/src/admin-action";

type Transaction = Parameters<Parameters<MySql2Database["transaction"]>[0]>[0];

/** Проверяем допустимость текущего административного автора до операции. */
export function requireAdminActionActor(
  current: User | undefined,
  actor: User,
  kind?: AdminActionKind,
) {
  if (
    !current ||
    current.openId !== actor.openId ||
    current.sessionVersion !== actor.sessionVersion
  )
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (
    current.blockedAt ||
    current.accountDeletionRequestedAt ||
    !(kind === "grantClub"
      ? current.role === "admin"
      : ["admin", "moderator"].includes(current.role))
  )
    throw new TRPCError({ code: "FORBIDDEN" });
}
/** Lock both owners in the same order for legacy and receipt-backed actions. */
export async function lockAdminActionActor(
  tx: Transaction,
  actor: User,
  targetUserId: number,
  kind: AdminActionKind,
) {
  const owners = await tx
    .select()
    .from(users)
    .where(inArray(users.id, [actor.id, targetUserId]))
    .orderBy(asc(users.id))
    .for("update");
  requireAdminActionActor(
    owners.find((user) => user.id === actor.id),
    actor,
    kind,
  );
}
