import { and, eq, isNull, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { users } from "../../../../packages/database/src/schema";
import { MAX_PROFILE_REVISION, type ProfileUpdateInput } from "./profile-input";

/** Version and actor predicates fence delayed requests, including ABA changes. */
export function saveProfile(
  database: MySql2Database,
  userId: number,
  sessionVersion: number,
  input: ProfileUpdateInput,
) {
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!current || current.sessionVersion !== sessionVersion)
      throw new TRPCError({ code: "UNAUTHORIZED" });
    if (current.blockedAt || current.accountDeletionRequestedAt)
      throw new TRPCError({ code: "FORBIDDEN" });
    if (current.profileRevision !== input.expectedRevision)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Профиль уже изменился. Проверьте актуальные данные перед сохранением.",
      });
    const { expectedRevision, ...patch } = input;
    if (!Object.keys(patch).length) return current.profileRevision;
    if (expectedRevision >= MAX_PROFILE_REVISION)
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
    const [result] = await tx
      .update(users)
      .set({ ...patch, profileRevision: sql`${users.profileRevision}+1` })
      .where(
        and(
          eq(users.id, userId),
          eq(users.profileRevision, expectedRevision),
          eq(users.sessionVersion, sessionVersion),
          isNull(users.blockedAt),
          isNull(users.accountDeletionRequestedAt),
        ),
      );
    if (result.affectedRows !== 1)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Профиль изменился. Повторите проверку.",
      });
    return expectedRevision + 1;
  });
}
