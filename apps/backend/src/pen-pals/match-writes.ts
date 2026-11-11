/** Создание и подтверждение пары проверяют участников, актуальные анкеты и срок заявки. */
import { TRPCError } from "@trpc/server";
import { and, eq, gt, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  penPalMatches,
  penPalProfiles,
  users,
} from "../../../../packages/database/src/schema";
import { PEN_PAL_CONFIRM_DAYS } from "../../../../packages/shared/src/pen-pals";

import {
  lockPenPalActor,
  penPalActorColumns,
  requirePenPalActor,
  type PenPalActor,
} from "./actor";

type Transaction = Parameters<Parameters<MySql2Database["transaction"]>[0]>[0];
type Match = typeof penPalMatches.$inferSelect;
const unavailable = () =>
  new TRPCError({ code: "NOT_FOUND", message: "Заявка недоступна" });
const ownedMatch = (id: number, actorId: number) =>
  and(
    eq(penPalMatches.id, id),
    or(
      eq(penPalMatches.userLowId, actorId),
      eq(penPalMatches.userHighId, actorId),
    ),
  );

async function requireActivePair(
  tx: Transaction,
  low: number,
  high: number,
  actor: PenPalActor,
) {
  // A stable lock order serializes reciprocal requests with account retirement
  // and profile deactivation. A row checked only before this transaction is stale.
  for (const id of [low, high]) {
    const [user] = await tx
      .select(penPalActorColumns)
      .from(users)
      .where(eq(users.id, id))
      .for("update");
    if (id === actor.id) requirePenPalActor(user, actor);
    if (!user || user.blockedAt) throw unavailable();
  }
  for (const id of [low, high]) {
    const [profile] = await tx
      .select({ userId: penPalProfiles.userId, active: penPalProfiles.active })
      .from(penPalProfiles)
      .where(eq(penPalProfiles.userId, id))
      .for("update");
    if (!profile?.active) throw unavailable();
  }
}

function requireUnexpired(row: Match) {
  if (
    !row.mutualConfirmedAt &&
    (!Number.isFinite(row.confirmDeadline.getTime()) ||
      row.confirmDeadline.getTime() <= Date.now())
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Срок подтверждения заявки истёк",
    });
  }
}

async function confirm(tx: Transaction, row: Match, actorId: number) {
  requireUnexpired(row);
  const isLow = row.userLowId === actorId;
  if (
    row.mutualConfirmedAt ||
    (isLow ? row.userLowConfirmed : row.userHighConfirmed)
  )
    return;
  const userLowConfirmed = isLow || row.userLowConfirmed;
  const userHighConfirmed = !isLow || row.userHighConfirmed;
  const [result] = await tx
    .update(penPalMatches)
    .set({
      userLowConfirmed,
      userHighConfirmed,
      mutualConfirmedAt:
        userLowConfirmed && userHighConfirmed ? new Date() : null,
    })
    .where(
      and(
        ownedMatch(row.id, actorId),
        gt(penPalMatches.confirmDeadline, sql`CURRENT_TIMESTAMP`),
      ),
    );
  if (result.affectedRows !== 1)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Срок подтверждения заявки истёк",
    });
}

/** Перед созданием пары проверяем текущих участников и активность обеих анкет. */
export async function requestMatch(
  database: MySql2Database,
  actor: PenPalActor,
  targetUserId: number,
): Promise<number> {
  const userId = actor.id;
  if (userId === targetUserId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Нельзя выбрать себя",
    });
  const [low, high] =
    userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];
  return database.transaction(async (tx) => {
    await requireActivePair(tx, low, high, actor);
    const [row] = await tx
      .select()
      .from(penPalMatches)
      .where(
        and(
          eq(penPalMatches.userLowId, low),
          eq(penPalMatches.userHighId, high),
        ),
      )
      .limit(1)
      .for("update");
    if (row) {
      // Retry is the same consent, never a fresh deadline for the other member.
      await confirm(tx, row, userId);
      return row.id;
    }
    const [result] = await tx.insert(penPalMatches).values({
      userLowId: low,
      userHighId: high,
      initiatedBy: userId,
      userLowConfirmed: userId === low,
      userHighConfirmed: userId === high,
      confirmDeadline: new Date(
        Date.now() + PEN_PAL_CONFIRM_DAYS * 24 * 60 * 60 * 1000,
      ),
      mutualConfirmedAt: null,
    });
    return Number(result.insertId);
  });
}

/** Даже отказ доступен только участнику пары; проверка владельца предшествует удалению заявки. */
export async function respondMatch(
  database: MySql2Database,
  actor: PenPalActor,
  matchId: number,
  accept: boolean,
): Promise<void> {
  const userId = actor.id;
  await database.transaction(async (tx) => {
    const [initial] = await tx
      .select()
      .from(penPalMatches)
      .where(ownedMatch(matchId, userId))
      .limit(1);
    if (
      !initial ||
      (initial.userLowId !== userId && initial.userHighId !== userId)
    )
      throw unavailable();
    if (!accept) {
      await lockPenPalActor(tx, actor);
      // Declining must remain possible even if an account/profile is no longer active.
      await tx.delete(penPalMatches).where(ownedMatch(matchId, userId));
      return;
    }
    await requireActivePair(tx, initial.userLowId, initial.userHighId, actor);
    const [row] = await tx
      .select()
      .from(penPalMatches)
      .where(ownedMatch(matchId, userId))
      .limit(1)
      .for("update");
    if (!row || (row.userLowId !== userId && row.userHighId !== userId))
      throw unavailable();
    await confirm(tx, row, userId);
  });
}
