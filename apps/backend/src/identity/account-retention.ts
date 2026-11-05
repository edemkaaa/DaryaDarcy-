import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  users,
  type User,
  clubPayments,
  commentReports,
  likes,
  penPalMatches,
  penPalProfiles,
  penPalShown,
  postComments,
  pushTokens,
  savedPosts,
} from "../../../../packages/database/src/schema";
import { getDb } from "../database/connection";
import { purgeOldPostComments } from "../content/comments";
import { cancelDeletedUserEmailBindings } from "./email-binding-retention";
import { retireContentRecovery } from "../content/recovery-retirement";
import { retirePublicPhotoReceipts } from "../media/public-photo-receipts";
import { deactivatePenPalProfile } from "../pen-pals/profiles";
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DataWriter =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Preserve the first request and fence actors invalidated while awaiting SQL. */
export async function requestAccountDeletion(
  actor: Pick<User, "id" | "openId" | "sessionVersion">,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(users)
      .where(eq(users.id, actor.id))
      .for("update");
    if (
      !current ||
      current.openId !== actor.openId ||
      current.sessionVersion !== actor.sessionVersion
    )
      throw new TRPCError({ code: "UNAUTHORIZED" });
    if (current.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
    if (current.accountDeletionRequestedAt) return;
    await tx
      .update(users)
      .set({ accountDeletionRequestedAt: new Date() })
      .where(eq(users.id, actor.id));
  });
}

const DELETED_USER_LABEL = "Удалённый аккаунт";
const ANONYMIZED_COMMENT_TEXT = "Комментарий удалён";
const MS_DAY = 24 * 60 * 60 * 1000;

export async function anonymizeUserComments(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return scrubUserComments(db, userId);
}

async function scrubUserComments(
  db: DataWriter,
  userId: number,
): Promise<number> {
  const result = await db
    .update(postComments)
    .set({ text: ANONYMIZED_COMMENT_TEXT, photos: null })
    .where(eq(postComments.userId, userId));
  return Number(result[0]?.affectedRows ?? 0);
}

async function scrubPenPalProfilePii(
  db: DataWriter,
  userId: number,
): Promise<void> {
  await db
    .update(penPalProfiles)
    .set({
      fullName: DELETED_USER_LABEL,
      city: DELETED_USER_LABEL,
      address: DELETED_USER_LABEL,
      interests: [],
      active: false,
    })
    .where(eq(penPalProfiles.userId, userId));
}

async function purgeUserActivity(
  db: DataWriter,
  userId: number,
): Promise<void> {
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
  await db.delete(likes).where(eq(likes.userId, userId));
  await db.delete(savedPosts).where(eq(savedPosts.userId, userId));
  await db
    .delete(penPalShown)
    .where(
      or(eq(penPalShown.userId, userId), eq(penPalShown.matchUserId, userId)),
    );
  await db
    .delete(commentReports)
    .where(eq(commentReports.reporterUserId, userId));
}

export async function processScheduledAccountDeletions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.accountDeletionRequestedAt));
  let processed = 0;
  const cutoffAfterClubMs = 30 * MS_DAY;

  for (const candidate of candidates) {
    const deleted = await db.transaction(async (tx) => {
      // Settlement locks this same owner. Re-read after waiting, not from the
      // candidate snapshot, and keep every scrub operation on this transaction.
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, candidate.id))
        .for("update");
      if (!user?.accountDeletionRequestedAt) return false;
      const [latest] = await tx
        .select({ expiresAt: clubPayments.expiresAt })
        .from(clubPayments)
        .where(
          and(
            eq(clubPayments.userId, user.id),
            eq(clubPayments.status, "paid"),
          ),
        )
        .orderBy(desc(clubPayments.expiresAt))
        .limit(1);
      const retentionStart =
        latest?.expiresAt ?? user.accountDeletionRequestedAt;
      if (Date.now() < retentionStart.getTime() + cutoffAfterClubMs)
        return false;

      await deactivatePenPalProfile(tx, user.id);
      await scrubPenPalProfilePii(tx, user.id);
      await scrubUserComments(tx, user.id);
      await purgeUserActivity(tx, user.id);
      await cancelDeletedUserEmailBindings(tx, user.id);
      await retireContentRecovery(tx, user.id);
      await retirePublicPhotoReceipts(tx, user.id);
      await tx
        .update(clubPayments)
        .set({ contactPhone: null })
        .where(eq(clubPayments.userId, user.id));
      await tx
        .update(users)
        .set({
          name: DELETED_USER_LABEL,
          email: null,
          phone: null,
          contactPhone: null,
          avatarUrl: null,
          passwordHash: null,
          loginMethod: null,
          blockedAt: null,
          blockedReason: null,
          accountDeletionRequestedAt: null,
          openId: `deleted-${user.id}-${Date.now()}`,
          // Fence contexts authenticated before final retirement, not only new logins.
          sessionVersion: sql`${users.sessionVersion}+1`,
        })
        .where(eq(users.id, user.id));
      return true;
    });
    if (deleted) processed += 1;
  }
  return processed;
}

export async function purgeStalePenPalData(): Promise<{
  profiles: number;
  matches: number;
}> {
  const db = await getDb();
  if (!db) return { profiles: 0, matches: 0 };
  const now = new Date();
  const inactiveCutoff = new Date(Date.now() - 30 * MS_DAY);
  const clubExpiredCutoff = new Date(Date.now() - 90 * MS_DAY);

  // Срок подтверждения ограничивает только незавершённые заявки.
  const expiredMatches = await db
    .delete(penPalMatches)
    .where(
      and(
        isNull(penPalMatches.mutualConfirmedAt),
        lt(penPalMatches.confirmDeadline, now),
      ),
    );
  const matches = Number(expiredMatches[0]?.affectedRows ?? 0);

  const inactiveProfiles = await db
    .select({ id: penPalProfiles.id, userId: penPalProfiles.userId })
    .from(penPalProfiles)
    .where(
      and(
        eq(penPalProfiles.active, false),
        lt(penPalProfiles.updatedAt, inactiveCutoff),
      ),
    );
  let profiles = 0;
  for (const row of inactiveProfiles) {
    // Повторяем условия удаления, потому что после выборки анкету могли
    // заново заполнить или отозвать. Учитываем только фактически удалённые строки.
    const [removed] = await db
      .delete(penPalProfiles)
      .where(
        and(
          eq(penPalProfiles.id, row.id),
          eq(penPalProfiles.userId, row.userId),
          eq(penPalProfiles.active, false),
          lt(penPalProfiles.updatedAt, inactiveCutoff),
        ),
      );
    profiles += removed.affectedRows;
  }

  // Отбираем анкеты по последнему оплаченному сроку, чтобы не блокировать
  // всех пользователей. Итоговое решение принимаем внутри транзакции.
  const lapsedPayments = db
    .select({ userId: clubPayments.userId })
    .from(clubPayments)
    .where(eq(clubPayments.status, "paid"))
    .groupBy(clubPayments.userId)
    .having(
      sql`max(${clubPayments.expiresAt}) < ${sql.param(clubExpiredCutoff, clubPayments.expiresAt)}`,
    )
    .as("lapsed_pen_pal_payments");
  const batchSize = 100;
  // Переходим к следующей порции по ID. Состав списка меняется по мере деактивации.
  let afterId: number | undefined;
  while (true) {
    const activeProfiles = await db
      .select({ id: penPalProfiles.id, userId: penPalProfiles.userId })
      .from(penPalProfiles)
      .innerJoin(
        lapsedPayments,
        eq(lapsedPayments.userId, penPalProfiles.userId),
      )
      .where(
        and(
          eq(penPalProfiles.active, true),
          afterId === undefined ? undefined : gt(penPalProfiles.id, afterId),
        ),
      )
      .orderBy(asc(penPalProfiles.id))
      .limit(batchSize);
    for (const profile of activeProfiles) {
      const deactivated = await db.transaction(async (tx) => {
        // Оплата, ручное продление и запись анкеты используют ту же блокировку.
        // После ожидания заново читаем анкету и срок, затем удаляем связи в той же транзакции.
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, profile.userId))
          .for("update");
        if (!user) return false;
        const [current] = await tx
          .select({ active: penPalProfiles.active })
          .from(penPalProfiles)
          .where(eq(penPalProfiles.userId, profile.userId))
          .for("update");
        if (!current?.active) return false;
        const [latest] = await tx
          .select({ expiresAt: clubPayments.expiresAt })
          .from(clubPayments)
          .where(
            and(
              eq(clubPayments.userId, profile.userId),
              eq(clubPayments.status, "paid"),
            ),
          )
          .orderBy(desc(clubPayments.expiresAt))
          .limit(1);
        if (!latest?.expiresAt || latest.expiresAt >= clubExpiredCutoff)
          return false;
        await deactivatePenPalProfile(tx, profile.userId);
        return true;
      });
      if (deactivated) profiles += 1;
    }
    if (activeProfiles.length < batchSize) break;
    afterId = activeProfiles[activeProfiles.length - 1].id;
  }

  return { profiles, matches };
}

export async function runDataRetentionMaintenance(): Promise<void> {
  const comments = await purgeOldPostComments();
  const deleted = await processScheduledAccountDeletions();
  const penPals = await purgeStalePenPalData();
  if (comments || deleted || penPals.profiles || penPals.matches) {
    console.log(
      `[maintenance] comments=${comments} accounts=${deleted} penPalProfiles=${penPals.profiles} penPalMatches=${penPals.matches}`,
    );
  }
}
