/** Перед записью заново проверяем текущую сессию и права автора под блокировкой строки пользователя. */
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { users, type User } from "../../../../packages/database/src/schema";
import type { ContentTransaction } from "./post-deletion";

export type ContentWriteActor = Pick<User, "id" | "sessionVersion">;

/** Заново читаем текущую сессию под блокировкой пользователя перед записью материала. */
/** Удерживает строку текущего пользователя в выбранном lock-mode до коммита, сверяет sessionVersion и блокировку после ожидания SQL. */
export async function lockCurrentContentActor(
  tx: Pick<ContentTransaction, "select">,
  actor: ContentWriteActor,
  lockMode: "update" | "share" = "update",
) {
  const [current] = await tx.select().from(users).where(eq(users.id, actor.id)).for(lockMode);
  if (!current || current.sessionVersion !== actor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (current.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
  return current;
}

/** HTTP adapters always supply the authenticated epoch; actorless system writes stay internal. */
/** HTTP обязан передать actor; под текущей user-lock требует admin, а отсутствие actor оставлено лишь доверенным внутренним системным вызовам. */
export async function assertContentWriteActor(
  tx: Pick<ContentTransaction, "select">,
  actor: ContentWriteActor | undefined,
  lockMode: "update" | "share" = "update",
) {
  if (!actor) return;
  const current = await lockCurrentContentActor(tx, actor, lockMode);
  if (current.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN" });
  // Pending deletion timing/roles are unchanged. Final retirement changes the epoch.
}
