import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { users, type User } from "../../../../packages/database/src/schema";
import type { ContentTransaction } from "./post-deletion";

export type ContentWriteActor = Pick<User, "id" | "sessionVersion">;

export async function lockCurrentContentActor(
  tx: Pick<ContentTransaction, "select">,
  actor: ContentWriteActor,
) {
  const [current] = await tx.select().from(users).where(eq(users.id, actor.id)).for("update");
  if (!current || current.sessionVersion !== actor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (current.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
  return current;
}

/** HTTP adapters always supply the authenticated epoch; actorless system writes stay internal. */
export async function assertContentWriteActor(
  tx: Pick<ContentTransaction, "select">,
  actor: ContentWriteActor | undefined,
) {
  if (!actor) return;
  const current = await lockCurrentContentActor(tx, actor);
  if (current.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN" });
  // Pending deletion timing/roles are unchanged. Final retirement changes the epoch.
}
