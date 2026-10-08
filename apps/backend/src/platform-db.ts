import { deletePostCommentInTransaction, purgeOldPostComments } from "./content/comments";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { queueCancellationForUser } from "./billing/cancellation";
import {
  adminAuditLog,
  clubPayments,
  commentReports,
  likes,
  penPalMatches,
  penPalProfiles,
  penPalShown,
  postComments,
  pushTokens,
  savedPosts,
  shopDeliveryEmails,
  userConsentEvents,
  users,
  type PenPalProfile,
  type User,
} from "../../../packages/database/src/schema";
import { PEN_PAL_CONFIRM_DAYS } from "../../../packages/shared/src/pen-pals";
import { getDb, isOwnerAccount } from "./db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DataWriter = Database | DatabaseTransaction;

export function isModeratorAccount(user: { role?: string | null; email?: string | null; openId?: string | null }): boolean {
  if (user.role === "moderator" || user.role === "admin") return true;
  return isOwnerAccount(user);
}

export function isStaffAccount(user: { role?: string | null; email?: string | null; openId?: string | null }): boolean {
  return isModeratorAccount(user);
}

export function isUserBlocked(user: Pick<User, "blockedAt"> | null | undefined): boolean {
  return Boolean(user?.blockedAt);
}

function penPalPairIds(a: number, b: number): { low: number; high: number } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

function asInterestList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export type PenPalMatchCard = {
  userId: number;
  matchId: number | null;
  name: string | null;
  avatarUrl: string | null;
  fullName: string;
  interests: string[];
  sharedInterests: string[];
  address?: string;
  myConfirmed: boolean;
  theirConfirmed: boolean;
  mutualConfirmed: boolean;
  confirmDeadline: Date | null;
};

export async function logUserConsent(
  userId: number,
  consentKey: string,
  status: "granted" | "revoked",
  consentVersion: string,
  consentText?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userConsentEvents).values({
    userId,
    consentKey,
    status,
    consentVersion,
    consentText: consentText?.slice(0, 8000) ?? null,
  });
}

type AdminActionInput = {
  actorUserId: number;
  action: string;
  targetType: string;
  targetId?: number | null;
  details?: string | null;
};

async function writeAdminAction(db: DataWriter, input: AdminActionInput): Promise<void> {
  await db.insert(adminAuditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    details: input.details ?? null,
  });
}

export async function logAdminAction(input: AdminActionInput): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await writeAdminAction(db, input);
}

export async function dismissCommentReport(actorUserId: number, reportId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    await tx.delete(commentReports).where(eq(commentReports.id, reportId));
    await writeAdminAction(tx, {
      actorUserId,
      action: "dismiss_comment_report",
      targetType: "comment_report",
      targetId: reportId,
    });
  });
}

export async function deleteReportedComment(actorUserId: number, commentId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    await deletePostCommentInTransaction(tx, commentId, 0, true);
    await writeAdminAction(tx, {
      actorUserId,
      action: "delete_reported_comment",
      targetType: "comment",
      targetId: commentId,
    });
  });
}

export async function blockUser(actorId: number, targetUserId: number, reason: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx=>{
    await tx.select().from(users).where(eq(users.id,targetUserId)).for("update");
    await tx.update(users).set({ blockedAt: new Date(), blockedReason: reason.slice(0, 512),sessionVersion:sql`${users.sessionVersion}+1` }).where(eq(users.id, targetUserId));
    await queueCancellationForUser(tx,targetUserId);
    await writeAdminAction(tx, {
      actorUserId: actorId,
      action: "block_user",
      targetType: "user",
      targetId: targetUserId,
      details: reason,
    });
  });
}

export async function unblockUser(actorId: number, targetUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    await tx.update(users).set({ blockedAt: null, blockedReason: null }).where(eq(users.id, targetUserId));
    await writeAdminAction(tx, {
      actorUserId: actorId,
      action: "unblock_user",
      targetType: "user",
      targetId: targetUserId,
    });
  });
}

export async function requestAccountDeletion(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.update(users).set({ accountDeletionRequestedAt: new Date() }).where(eq(users.id, userId));
  if (result.affectedRows === 0) throw new Error("Profile account not found");
}

export async function upsertPenPalProfileV2(
  userId: number,
  data: { fullName: string; interests: string[]; address: string; consentVersion: string },
): Promise<PenPalProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db.insert(penPalProfiles).values({
    userId,
    fullName: data.fullName,
    city: data.fullName,
    interests: data.interests,
    address: data.address,
    adultConsentAt: now,
    consentVersion: data.consentVersion,
    active: true,
  }).onDuplicateKeyUpdate({
    set: {
      fullName: data.fullName,
      city: data.fullName,
      interests: data.interests,
      address: data.address,
      adultConsentAt: now,
      consentVersion: data.consentVersion,
      active: true,
    },
  });
  const rows = await db.select().from(penPalProfiles).where(eq(penPalProfiles.userId, userId)).limit(1);
  if (!rows[0]) throw new Error("Failed to save pen pal profile");
  return rows[0];
}

export async function deactivatePenPalProfileV2(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await deactivatePenPalProfile(db, userId);
}

async function deactivatePenPalProfile(db: DataWriter, userId: number): Promise<void> {
  await db.update(penPalProfiles).set({ active: false }).where(eq(penPalProfiles.userId, userId));
  await db.delete(penPalMatches).where(or(eq(penPalMatches.userLowId, userId), eq(penPalMatches.userHighId, userId)));
}

async function matchRowForUser(row: typeof penPalMatches.$inferSelect, userId: number) {
  const isLow = row.userLowId === userId;
  return {
    myConfirmed: isLow ? row.userLowConfirmed : row.userHighConfirmed,
    theirConfirmed: isLow ? row.userHighConfirmed : row.userLowConfirmed,
    otherUserId: isLow ? row.userHighId : row.userLowId,
    mutualConfirmed: Boolean(row.mutualConfirmedAt),
    confirmDeadline: row.confirmDeadline,
  };
}

export async function listPenPalCards(userId: number, limit = 2): Promise<PenPalMatchCard[]> {
  const db = await getDb();
  if (!db) return [];

  const mine = await db.select().from(penPalProfiles).where(eq(penPalProfiles.userId, userId)).limit(1);
  const profile = mine[0];
  if (!profile?.active) return [];

  const now = new Date();
  await db.delete(penPalMatches).where(and(isNull(penPalMatches.mutualConfirmedAt), lt(penPalMatches.confirmDeadline, now)));

  const myInterests = asInterestList(profile.interests);
  const matchRows = await db
    .select()
    .from(penPalMatches)
    .where(or(eq(penPalMatches.userLowId, userId), eq(penPalMatches.userHighId, userId)));

  const cards: PenPalMatchCard[] = [];
  const matchedIds = new Set<number>();

  for (const row of matchRows) {
    const info = await matchRowForUser(row, userId);
    matchedIds.add(info.otherUserId);
    const [otherProfile] = await db.select().from(penPalProfiles).where(eq(penPalProfiles.userId, info.otherUserId)).limit(1);
    const [otherUser] = await db.select().from(users).where(eq(users.id, info.otherUserId)).limit(1);
    if (!otherProfile?.active) continue;
    const interests = asInterestList(otherProfile.interests);
    cards.push({
      userId: info.otherUserId,
      matchId: row.id,
      name: otherUser?.name ?? null,
      avatarUrl: otherUser?.avatarUrl ?? null,
      fullName: otherProfile.fullName || otherProfile.city,
      interests,
      sharedInterests: interests.filter((i) => myInterests.includes(i)),
      address: info.mutualConfirmed ? otherProfile.address : undefined,
      myConfirmed: info.myConfirmed,
      theirConfirmed: info.theirConfirmed,
      mutualConfirmed: info.mutualConfirmed,
      confirmDeadline: info.confirmDeadline,
    });
  }

  if (cards.length >= limit) return cards.slice(0, limit);

  const [others, shownRows] = await Promise.all([
    db.select().from(penPalProfiles).where(and(eq(penPalProfiles.active, true), ne(penPalProfiles.userId, userId))),
    db.select({ matchUserId: penPalShown.matchUserId }).from(penPalShown).where(eq(penPalShown.userId, userId)),
  ]);
  const shown = new Set(shownRows.map((r) => r.matchUserId));

  const ranked = others
    .filter((p) => !shown.has(p.userId) && !matchedIds.has(p.userId))
    .map((p) => {
      const interests = asInterestList(p.interests);
      const shared = interests.filter((i) => myInterests.includes(i));
      return { profile: p, interests, sharedInterests: shared, score: shared.length };
    })
    .filter((r) => r.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit - cards.length);

  for (const row of ranked) {
    try {
      await db.insert(penPalShown).values({ userId, matchUserId: row.profile.userId });
    } catch {
      // duplicate
    }
    const [u] = await db.select().from(users).where(eq(users.id, row.profile.userId)).limit(1);
    cards.push({
      userId: row.profile.userId,
      matchId: null,
      name: u?.name ?? null,
      avatarUrl: u?.avatarUrl ?? null,
      fullName: row.profile.fullName || row.profile.city,
      interests: row.interests,
      sharedInterests: row.sharedInterests,
      myConfirmed: false,
      theirConfirmed: false,
      mutualConfirmed: false,
      confirmDeadline: null,
    });
  }

  return cards;
}

export async function requestPenPalMatch(userId: number, targetUserId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (userId === targetUserId) throw new Error("Нельзя выбрать себя");

  const { low, high } = penPalPairIds(userId, targetUserId);
  const deadline = new Date(Date.now() + PEN_PAL_CONFIRM_DAYS * 24 * 60 * 60 * 1000);

  const existing = await db
    .select()
    .from(penPalMatches)
    .where(and(eq(penPalMatches.userLowId, low), eq(penPalMatches.userHighId, high)))
    .limit(1);

  if (existing[0]) {
    const row = existing[0];
    await db.update(penPalMatches).set({
      userLowConfirmed: row.userLowId === userId ? true : row.userLowConfirmed,
      userHighConfirmed: row.userHighId === userId ? true : row.userHighConfirmed,
      confirmDeadline: deadline,
      mutualConfirmedAt:
        (row.userLowId === userId || row.userLowConfirmed) && (row.userHighId === userId || row.userHighConfirmed)
          ? row.mutualConfirmedAt ?? new Date()
          : row.mutualConfirmedAt,
    }).where(eq(penPalMatches.id, row.id));
    return row.id;
  }

  const result = await db.insert(penPalMatches).values({
    userLowId: low,
    userHighId: high,
    initiatedBy: userId,
    userLowConfirmed: userId === low,
    userHighConfirmed: userId === high,
    confirmDeadline: deadline,
    mutualConfirmedAt: null,
  });
  return Number(result[0].insertId);
}

export async function respondPenPalMatch(userId: number, matchId: number, accept: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(penPalMatches).where(eq(penPalMatches.id, matchId)).limit(1);
  if (!row) throw new Error("Match not found");
  if (!accept) {
    await db.delete(penPalMatches).where(eq(penPalMatches.id, matchId));
    return;
  }
  const isLow = row.userLowId === userId;
  const isHigh = row.userHighId === userId;
  if (!isLow && !isHigh) throw new Error("Forbidden");

  const userLowConfirmed = isLow ? true : row.userLowConfirmed;
  const userHighConfirmed = isHigh ? true : row.userHighConfirmed;
  const mutual = userLowConfirmed && userHighConfirmed;

  await db.update(penPalMatches).set({
    userLowConfirmed,
    userHighConfirmed,
    mutualConfirmedAt: mutual ? row.mutualConfirmedAt ?? new Date() : null,
  }).where(eq(penPalMatches.id, matchId));
}


export async function queueShopDeliveryEmail(input: {
  orderId: string;
  userId: number | null;
  email: string;
  productId: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(shopDeliveryEmails).values({
    orderId: input.orderId,
    userId: input.userId,
    email: input.email,
    productId: input.productId,
  }).onDuplicateKeyUpdate({
    set: { email: input.email, productId: input.productId },
  });
}

export async function isShopDeliveryEmailSent(orderId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ sentAt: shopDeliveryEmails.sentAt })
    .from(shopDeliveryEmails)
    .where(eq(shopDeliveryEmails.orderId, orderId))
    .limit(1);
  return Boolean(rows[0]?.sentAt);
}

export async function markShopDeliveryEmailSent(orderId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(shopDeliveryEmails).set({ sentAt: new Date() }).where(eq(shopDeliveryEmails.orderId, orderId));
}

export async function listPendingShopDeliveryEmails(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shopDeliveryEmails)
    .where(isNull(shopDeliveryEmails.sentAt))
    .orderBy(asc(shopDeliveryEmails.createdAt))
    .limit(limit);
}

const DELETED_USER_LABEL = "Удалённый аккаунт";
const ANONYMIZED_COMMENT_TEXT = "Комментарий удалён";
const MS_DAY = 24 * 60 * 60 * 1000;

export async function anonymizeUserComments(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return scrubUserComments(db, userId);
}

async function scrubUserComments(db: DataWriter, userId: number): Promise<number> {
  const result = await db
    .update(postComments)
    .set({ text: ANONYMIZED_COMMENT_TEXT, photos: null })
    .where(eq(postComments.userId, userId));
  return Number(result[0]?.affectedRows ?? 0);
}

async function scrubPenPalProfilePii(db: DataWriter, userId: number): Promise<void> {
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

async function purgeUserActivity(db: DataWriter, userId: number): Promise<void> {
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
  await db.delete(likes).where(eq(likes.userId, userId));
  await db.delete(savedPosts).where(eq(savedPosts.userId, userId));
  await db.delete(penPalShown).where(or(eq(penPalShown.userId, userId), eq(penPalShown.matchUserId, userId)));
  await db.delete(commentReports).where(eq(commentReports.reporterUserId, userId));
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
    const deleted = await db.transaction(async tx => {
      // Settlement locks this same owner. Re-read after waiting, not from the
      // candidate snapshot, and keep every scrub operation on this transaction.
      const [user] = await tx.select().from(users).where(eq(users.id, candidate.id)).for("update");
      if (!user?.accountDeletionRequestedAt) return false;
      const [latest] = await tx.select({ expiresAt: clubPayments.expiresAt })
        .from(clubPayments)
        .where(and(eq(clubPayments.userId, user.id), eq(clubPayments.status, "paid")))
        .orderBy(desc(clubPayments.expiresAt)).limit(1);
      const retentionStart = latest?.expiresAt ?? user.accountDeletionRequestedAt;
      if (Date.now() < retentionStart.getTime() + cutoffAfterClubMs) return false;

      await deactivatePenPalProfile(tx, user.id);
      await scrubPenPalProfilePii(tx, user.id);
      await scrubUserComments(tx, user.id);
      await purgeUserActivity(tx, user.id);
      await tx.update(users).set({
        name: DELETED_USER_LABEL,
        email: null,
        phone: null,
        avatarUrl: null,
        passwordHash: null,
        loginMethod: null,
        blockedAt: null,
        blockedReason: null,
        accountDeletionRequestedAt: null,
        openId: `deleted-${user.id}-${Date.now()}`,
      }).where(eq(users.id, user.id));
      return true;
    });
    if (deleted) processed += 1;
  }
  return processed;
}

export async function purgeStalePenPalData(): Promise<{ profiles: number; matches: number }> {
  const db = await getDb();
  if (!db) return { profiles: 0, matches: 0 };
  const now = new Date();
  const inactiveCutoff = new Date(Date.now() - 30 * MS_DAY);
  const clubExpiredCutoff = new Date(Date.now() - 90 * MS_DAY);

  const expiredMatches = await db
    .delete(penPalMatches)
    .where(and(isNull(penPalMatches.mutualConfirmedAt), lt(penPalMatches.confirmDeadline, now)));
  const matches = Number(expiredMatches[0]?.affectedRows ?? 0);

  const inactiveProfiles = await db
    .select({ userId: penPalProfiles.userId })
    .from(penPalProfiles)
    .where(and(eq(penPalProfiles.active, false), lt(penPalProfiles.updatedAt, inactiveCutoff)));
  let profiles = 0;
  for (const row of inactiveProfiles) {
    await db.delete(penPalProfiles).where(eq(penPalProfiles.userId, row.userId));
    profiles += 1;
  }

  const { getLatestClubExpiry } = await import("./db");
  const activeProfiles = await db.select().from(penPalProfiles).where(eq(penPalProfiles.active, true));
  for (const profile of activeProfiles) {
    const expiry = await getLatestClubExpiry(profile.userId);
    if (expiry && expiry < clubExpiredCutoff) {
      await deactivatePenPalProfileV2(profile.userId);
      profiles += 1;
    }
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
