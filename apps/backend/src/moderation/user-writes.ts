/** Изменения модерации и запись аудита фиксируются вместе после повторной проверки ролей. */
import { TRPCError } from "@trpc/server";
import { lockCurrentContentActor, type ContentWriteActor } from "../content/content-write-actor";
import { isStaffAccount } from "../identity/account-policy";
import { eq, sql } from "drizzle-orm";
import {
  users,
  commentReports,
} from "../../../../packages/database/src/schema";
import { getDb } from "../database/connection";
import { queueCancellationForUser } from "../billing/cancellation";
import { deletePostCommentInTransaction } from "../content/comments";
import { lockUserModerationTarget } from "./user-target";
import { writeAdminAction } from "../admin/audit-log";

/** Под текущей staff-сессией удаляем жалобу и сохраняем аудит в той же транзакции. */
export async function dismissCommentReport(
  actor: ContentWriteActor,
  reportId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const current = await lockCurrentContentActor(tx, actor);
    if (!isStaffAccount(current)) throw new TRPCError({ code: "FORBIDDEN" });
    await tx.delete(commentReports).where(eq(commentReports.id, reportId));
    await writeAdminAction(tx, {
      actorUserId: current.id,
      action: "dismiss_comment_report",
      targetType: "comment_report",
      targetId: reportId,
    });
  });
}

/** Заново проверяем служебную роль и удаляем комментарий общим транзакционным путём с зависимостями и аудитом. */
export async function deleteReportedComment(
  actor: ContentWriteActor,
  commentId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const current = await lockCurrentContentActor(tx, actor);
    if (!isStaffAccount(current)) throw new TRPCError({ code: "FORBIDDEN" });
    await deletePostCommentInTransaction(tx, commentId, 0, true);
    await writeAdminAction(tx, {
      actorUserId: current.id,
      action: "delete_reported_comment",
      targetType: "comment",
      targetId: commentId,
    });
  });
}

/** После стабильной блокировки исполнителя и цели атомарно блокируем аккаунт, увеличиваем epoch, ставим отмену подписки и сохраняем причину в аудит. */
export async function blockUser(
  actor: ContentWriteActor,
  targetUserId: number,
  reason: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await lockUserModerationTarget(tx, actor, targetUserId);
    await tx
      .update(users)
      .set({
        blockedAt: new Date(),
        blockedReason: reason.slice(0, 512),
        sessionVersion: sql`${users.sessionVersion}+1`,
      })
      .where(eq(users.id, targetUserId));
    await queueCancellationForUser(tx, targetUserId);
    await writeAdminAction(tx, {
      actorUserId: actor.id,
      action: "block_user",
      targetType: "user",
      targetId: targetUserId,
      details: reason,
    });
  });
}

/** Повторно проверяем право на цель, снимаем признаки блокировки и записываем аудит; прежние отозванные сессии этим не восстанавливаются. */
export async function unblockUser(
  actor: ContentWriteActor,
  targetUserId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await lockUserModerationTarget(tx, actor, targetUserId);
    await tx
      .update(users)
      .set({ blockedAt: null, blockedReason: null })
      .where(eq(users.id, targetUserId));
    await writeAdminAction(tx, {
      actorUserId: actor.id,
      action: "unblock_user",
      targetType: "user",
      targetId: targetUserId,
    });
  });
}
