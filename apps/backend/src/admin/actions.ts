import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  adminActionOperations,
  clubPayments,
  users,
  type User,
} from "../../../../packages/database/src/schema";
import {
  adminActionKey,
  adminActionOutcome,
  type AdminActionKind,
  type AdminActionOutcome,
} from "../../../../packages/shared/src/admin-action";
import { grantClubAccessInTransaction } from "../billing/grants";
import { resendClubAccessInTransaction } from "../identity/access";

function requireActor(
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
function requireKey(key: string) {
  if (!adminActionKey.safeParse(key).success)
    throw new TRPCError({ code: "BAD_REQUEST" });
}

export async function executeAdminAction(
  database: MySql2Database,
  actor: User,
  input: {
    idempotencyKey: string;
    kind: AdminActionKind;
    userId: number;
  },
): Promise<AdminActionOutcome> {
  requireKey(input.idempotencyKey);
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0)
    throw new TRPCError({ code: "BAD_REQUEST" });
  const payloadHash = createHash("sha256")
    .update(
      JSON.stringify([
        "admin-action:v1",
        input.kind,
        input.userId,
        input.kind === "grantClub" ? 31 : "club-access",
      ]),
    )
    .digest("hex");
  return database.transaction(async (tx) => {
    // Consistent owner ordering also covers two admins acting on each other.
    const owners = await tx
      .select()
      .from(users)
      .where(inArray(users.id, [actor.id, input.userId]))
      .orderBy(asc(users.id))
      .for("update");
    requireActor(
      owners.find((user) => user.id === actor.id),
      actor,
      input.kind,
    );
    const key = and(
      eq(adminActionOperations.actorUserId, actor.id),
      eq(adminActionOperations.operationKey, input.idempotencyKey),
    );
    const [saved] = await tx.select().from(adminActionOperations).where(key);
    if (saved) {
      if (
        saved.kind !== input.kind ||
        saved.targetUserId !== input.userId ||
        saved.payloadHash !== payloadHash
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ключ уже использован для другого действия",
        });
      return adminActionOutcome.parse(saved.result);
    }
    let result: AdminActionOutcome;
    try {
      if (input.kind === "grantClub") {
        await grantClubAccessInTransaction(tx, input.userId, 31);
        // TIMESTAMP precision may differ from Date.now(); receipt reflects SQL.
        const [grant] = await tx
          .select({ expiresAt: clubPayments.expiresAt })
          .from(clubPayments)
          .where(
            and(
              eq(clubPayments.userId, input.userId),
              eq(clubPayments.status, "paid"),
            ),
          )
          .orderBy(desc(clubPayments.expiresAt))
          .limit(1);
        if (!grant?.expiresAt) throw new Error("Committed grant unavailable");
        result = {
          state: "succeeded",
          kind: input.kind,
          userId: input.userId,
          expiresAt: grant.expiresAt.toISOString(),
        };
      } else {
        const queued = await resendClubAccessInTransaction(
          tx,
          actor.id,
          input.userId,
        );
        result = queued
          ? {
              state: "succeeded",
              kind: input.kind,
              userId: input.userId,
              queued: true,
            }
          : {
              state: "rejected",
              kind: input.kind,
              userId: input.userId,
              code: "CONFLICT",
            };
      }
    } catch (error) {
      // Only pre-effect business denials are durable. Infrastructure errors roll back.
      if (
        !(error instanceof TRPCError) ||
        !["NOT_FOUND", "CONFLICT"].includes(error.code)
      )
        throw error;
      result = {
        state: "rejected",
        kind: input.kind,
        userId: input.userId,
        code: error.code as "NOT_FOUND" | "CONFLICT",
      };
    }
    await tx.insert(adminActionOperations).values({
      actorUserId: actor.id,
      operationKey: input.idempotencyKey,
      kind: input.kind,
      targetUserId: input.userId,
      payloadHash,
      result,
    });
    return result;
  });
}

/** No action, mail or expiry mutation. A missing receipt is not proof of cancellation. */
export async function readAdminAction(
  database: MySql2Database,
  actor: User,
  idempotencyKey: string,
): Promise<AdminActionOutcome | { state: "notFound" }> {
  requireKey(idempotencyKey);
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(users)
      .where(eq(users.id, actor.id))
      .for("update");
    requireActor(current, actor);
    const [saved] = await tx
      .select()
      .from(adminActionOperations)
      .where(
        and(
          eq(adminActionOperations.actorUserId, actor.id),
          eq(adminActionOperations.operationKey, idempotencyKey),
        ),
      );
    if (!saved) return { state: "notFound" };
    requireActor(current, actor, saved.kind);
    return adminActionOutcome.parse(saved.result);
  });
}
