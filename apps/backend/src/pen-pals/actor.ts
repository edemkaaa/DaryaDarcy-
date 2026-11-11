/** Повторно проверяем владельца анкеты по текущей сессии внутри транзакции. */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { users, type User } from "../../../../packages/database/src/schema";

export type PenPalActor = Pick<User, "id" | "openId" | "sessionVersion">;
type Transaction = Parameters<Parameters<MySql2Database["transaction"]>[0]>[0];
export const penPalActorColumns = {
  id: users.id,
  openId: users.openId,
  sessionVersion: users.sessionVersion,
  blockedAt: users.blockedAt,
};

/** Проверяем, что автор запроса остаётся действующим владельцем анкеты. */
export function requirePenPalActor(
  current:
    | Pick<User, "id" | "openId" | "sessionVersion" | "blockedAt">
    | undefined,
  actor: PenPalActor,
) {
  if (
    !current ||
    current.openId !== actor.openId ||
    current.sessionVersion !== actor.sessionVersion
  )
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (current.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
}

/** Блокировка пользователя согласует запись анкеты и изменения её связей. */
export async function lockPenPalActor(tx: Transaction, actor: PenPalActor) {
  const [current] = await tx
    .select(penPalActorColumns)
    .from(users)
    .where(eq(users.id, actor.id))
    .for("update");
  requirePenPalActor(current, actor);
}
