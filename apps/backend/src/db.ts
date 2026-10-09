import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { settleClubOrder } from "./billing/settlement";
import { grantClubAccess } from "./billing/grants";
import {
  listAdminMembers as readAdminMembers,
  listAdminPayments as readAdminPayments,
} from "./admin/membership-repository";
import { confirmPostPublication, type PostPublication } from "./content/publication";
import { savePostEdit as persistPostEdit } from "./content/post-editor";
import { deletePost as persistPostDeletion } from "./content/post-deletion";
import {
  getPostMediaByPostId as readPostMediaByPostId,
} from "./content/post-media-repository";
import {
  getPostById as readPostDetail,
  getLatestPublishedPost as readLatestPublishedPost,
} from "./content/post-detail-repository";
import {
  getAllTags as readAllTags,
  getPosts as readPosts,
  getPostsPaginated as readPostPage,
  getPostsByIds as readPostsByIds,
  getPostsForTarget as readTargetPosts,
} from "./content/post-catalog-repository";
import {
  getAllPostsAdmin as readAllAdminPosts,
  getAdminPostsFiltered as readAdminPostsFiltered,
  getScheduledPosts as readScheduledPosts,
  getPostStatistics as readPostStatistics,
} from "./content/post-admin-repository";
import {
  getVideos as readVideos,
  getVideoById as readVideoById,
  getVideoByYoutubeId as readVideoByYoutubeId,
  createVideo as persistVideoCreation,
  bulkImportVideos as persistVideoImport,
  updateVideo as persistVideoUpdate,
  deleteVideo as persistVideoDeletion,
} from "./content/video-repository";
import {
  listPublishedArticles as readPublishedArticles,
  listAllArticles as readAllArticles,
  getArticleById as readArticleById,
} from "./content/article-repository";
import {
  createArticle as persistArticleCreation,
  updateArticle as persistArticleUpdate,
  deleteArticle as persistArticleDeletion,
  type CreateArticleInput,
  type UpdateArticleInput,
} from "./content/article-writes";
import {
  createPostWithVideos as persistNewPost,
  createPostOnce as persistPostOnce,
} from "./content/post-creator";
import type { PostCreationIntent } from "./content/post-creation-request";
import type { PostAttachmentChanges } from "./content/post-attachments";
import {
  togglePostReaction,
  getUserLikedPostIds as readUserLikedPostIds,
  getUserSavedPostIds as readUserSavedPostIds,
} from "./content/post-reactions";
import {
  MARKETING_PUSH_CONSENT_VERSION,
  type PushConsentStatus,
  type PushConsentType,
} from "../../../packages/shared/src/push-consent";
import {
  InsertUser,
  User,
  users,
  pushTokens,
  pushConsentEvents,
  postMedia,
  InsertPostMedia,
  PostMedia,
} from "../../../packages/database/src/schema";
import { ENV } from "./_core/env";
import { normalizeEmail } from "./_core/password";

export function emailToOpenId(email: string): string {
  const hash = createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 40);
  return `e_${hash}`;
}

export function phoneToOpenId(phone: string): string {
  const hash = createHash("sha256").update(phone).digest("hex").slice(0, 40);
  return `p_${hash}`;
}

export function isOwnerAccount(user: { email?: string | null; openId?: string | null; role?: string | null }): boolean {
  return user.role === "admin";
}

let _db: MySql2Database | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL?.replace(/\r/g, "").trim();
  if (!url) return null;
  try {
    const pool = mysql.createPool({ uri: url, charset: "utf8mb4_unicode_ci", timezone: "Z", connectionLimit: 10 });
    pool.on("connection", (connection) => {
      // mysql2 queues this before the first command on each new connection.
      connection.query("SET time_zone = '+00:00'");
    });
    _db = drizzle({ client: pool });
  } catch (error) {
    console.warn("[Database] Failed to connect");
    _db = null;
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.transaction(async (tx) => {
      // A duplicate may belong to any unique key, not just openId. Never
      // apply credentials to that row until the requested identity is locked.
      await tx.insert(users).values(values).onDuplicateKeyUpdate({
        set: { openId: sql`${users.openId}` },
      });
      const [identity] = await tx.select({ id: users.id }).from(users)
        .where(eq(users.openId, user.openId)).limit(1).for("update");
      if (!identity) throw new Error("User identity conflict");
      await tx.update(users).set(updateSet).where(eq(users.id, identity.id));
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByPhone(phone: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function ensureUserByEmail(email: string): Promise<User> {
  const normalized = normalizeEmail(email);
  const existing = await getUserByEmail(normalized);
  if (existing) return existing;
  const openId = emailToOpenId(normalized);
  await upsertUser({
    openId,
    email: normalized,
    name: null,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  const created = await getUserByOpenId(openId);
  if (!created) throw new Error("Не удалось создать аккаунт");
  return created;
}

// ── Profile update ──
export async function updateUserProfile(userId: number, data: { name?: string; gender?: "female" | "male"; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update profile: database not available");
    throw new Error("Database not available");
  }

  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.gender !== undefined) updateSet.gender = data.gender;
  if (data.avatarUrl !== undefined) updateSet.avatarUrl = data.avatarUrl;

  if (Object.keys(updateSet).length === 0) return;

  const [result] = await db.update(users).set(updateSet).where(eq(users.id, userId));
  if (result.affectedRows === 0) throw new Error("Profile account not found");
}

// ── Feed queries ──

import { posts, Post, InsertPost, Tag, Video, InsertVideo, penPalProfiles, penPalShown, PenPalProfile, clubPayments, ClubPayment, shopPurchases, ShopPurchase, postComments, commentLikes, commentReports, Article } from "../../../packages/database/src/schema";
import { desc, asc, and, sql, or, ne, gte, lte, isNotNull, isNull } from "drizzle-orm";

// Get all published posts, optionally filtered by tag
export async function getPosts(tagFilter?: string): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  return readPosts(await getDb(), tagFilter);
}

// Get paginated published posts (offset-based with SQL limit)
export async function getPostsPaginated(options: {
  tagFilter?: string;
  search?: string;
  limit: number;
  cursor?: number; // offset (page number * limit)
}): Promise<{ posts: (Post & { likeCount: number; media: PostMedia[] })[]; nextCursor: number | null }> {
  return readPostPage(await getDb(), options);
}

// Get a single post by ID
export async function getPostById(id: number): Promise<(Post & { likeCount: number }) | undefined> {
  return readPostDetail(await getDb(), id);
}

// Get all tags ordered by sortOrder
export async function getAllTags(): Promise<Tag[]> {
  return readAllTags(await getDb());
}

// Toggle like on a post
export async function toggleLike(userId: number, postId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return togglePostReaction(db, "like", userId, postId);
}

// Toggle save/bookmark on a post
export async function toggleSave(userId: number, postId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return togglePostReaction(db, "save", userId, postId);
}

// Get user's liked post IDs
export async function getUserLikedPostIds(userId: number): Promise<number[]> {
  return readUserLikedPostIds(await getDb(), userId);
}

// Get user's saved post IDs
export async function getUserSavedPostIds(userId: number): Promise<number[]> {
  return readUserSavedPostIds(await getDb(), userId);
}

export async function getPostsByIds(ids: number[]): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  if (ids.length === 0) return [];
  return readPostsByIds(await getDb(), ids);
}

export async function listAdminMembers(): Promise<{
  id: number;
  email: string | null;
  name: string | null;
  role: string | null;
  createdAt: Date;
  clubExpiresAt: Date | null;
  blockedAt: Date | null;
  blockedReason: string | null;
}[]> {
  const db = await getDb();
  return readAdminMembers(db);
}

export async function listAdminPayments(limit = 50) {
  const db = await getDb();
  return readAdminPayments(db, limit);
}

// ── Admin: Post CRUD ──

export async function createPost(data: InsertPost): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(posts).values(data);
  return Number(result[0].insertId);
}

export async function createPostWithVideos(
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges = {},
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistNewPost(db, data, videos, attachments);
}

export async function updatePost(id: number, data: Partial<InsertPost>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(posts).set(data).where(eq(posts.id, id));
}

export async function createPostOnce(
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges,
  intent: PostCreationIntent,
): Promise<{ postId: number; created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistPostOnce(db, data, videos, attachments, intent);
}

export async function savePostEdit(
  id: number,
  data: Partial<InsertPost>,
  videos?: string[],
  attachments: PostAttachmentChanges = {},
): Promise<PostPublication | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistPostEdit(db, id, data, videos, attachments);
}

export async function deletePost(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await persistPostDeletion(db, id);
}

// Get all posts for admin (including unpublished)
export async function getAllPostsAdmin(): Promise<(Post & { media: PostMedia[] })[]> {
  return readAllAdminPosts(await getDb());
}

// Get post by Instagram ID (for dedup during import)
export async function getPostByInstagramId(instagramId: string): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(posts)
    .where(eq(posts.instagramId, instagramId))
    .limit(1);

  return result[0];
}

export async function getPostBySource(source: string): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.source, source)).limit(1);
  return result[0];
}

// ── Push Tokens ──

export async function registerPushToken(token: string, userId?: number, platform?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Upsert: if token exists, update userId/platform
  await db.insert(pushTokens).values({
    token,
    userId: userId ?? null,
    platform: platform ?? null,
    enabled: true,
  }).onDuplicateKeyUpdate({
    set: {
      userId: userId ?? undefined,
      platform: platform ?? undefined,
      enabled: true,
    },
  });
}

export async function getAllEnabledPushTokens(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(eq(pushTokens.enabled, true), isNull(users.blockedAt)));

  return results.map((r) => r.token);
}

export async function getPushTokensForUser(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(eq(pushTokens.enabled, true), eq(pushTokens.userId, userId), isNull(users.blockedAt)));
  return results.map((r) => r.token);
}

export async function getClubMemberPushTokens(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const paid = await db
    .select({ userId: clubPayments.userId })
    .from(clubPayments)
    .where(and(eq(clubPayments.status, "paid"), gte(clubPayments.expiresAt, now)));
  const admins = await db
    .select({ id: users.id, email: users.email, openId: users.openId, role: users.role })
    .from(users);
  const memberIds = new Set<number>(paid.map((row) => row.userId));
  for (const user of admins) {
    if (isOwnerAccount(user)) memberIds.add(user.id);
  }
  if (memberIds.size === 0) return [];

  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(eq(pushTokens.enabled, true), inArray(pushTokens.userId, [...memberIds]), isNull(users.blockedAt)));

  return results.map((r) => r.token);
}

export async function logPushConsentEvent(
  userId: number,
  consentType: PushConsentType,
  status: PushConsentStatus,
  platform?: string,
  consentVersion: string = MARKETING_PUSH_CONSENT_VERSION,
  consentText?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(pushConsentEvents).values({
    userId,
    consentType,
    status,
    consentVersion,
    consentText: consentText?.slice(0, 8000) ?? null,
    platform: platform ?? null,
  });
}

export async function hasMarketingPushConsent(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const rows = await db
    .select({ status: pushConsentEvents.status })
    .from(pushConsentEvents)
    .where(and(eq(pushConsentEvents.userId, userId), eq(pushConsentEvents.consentType, "marketing")))
    .orderBy(desc(pushConsentEvents.createdAt), desc(pushConsentEvents.id))
    .limit(1);

  return rows[0]?.status === "granted";
}

async function getUserIdsWithMarketingConsent(): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();

  const rows = await db
    .select({
      userId: pushConsentEvents.userId,
      status: pushConsentEvents.status,
    })
    .from(pushConsentEvents)
    .where(eq(pushConsentEvents.consentType, "marketing"))
    .orderBy(desc(pushConsentEvents.createdAt), desc(pushConsentEvents.id));

  const latest = new Map<number, PushConsentStatus>();
  for (const row of rows) {
    if (!latest.has(row.userId)) {
      latest.set(row.userId, row.status);
    }
  }

  return new Set(
    [...latest.entries()].filter(([, status]) => status === "granted").map(([userId]) => userId),
  );
}

async function getClubMemberUserIds(): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();

  const now = new Date();
  const paid = await db
    .select({ userId: clubPayments.userId })
    .from(clubPayments)
    .where(and(eq(clubPayments.status, "paid"), gte(clubPayments.expiresAt, now)));
  const admins = await db
    .select({ id: users.id, email: users.email, openId: users.openId, role: users.role })
    .from(users);
  const memberIds = new Set<number>(paid.map((row) => row.userId));
  for (const user of admins) {
    if (isOwnerAccount(user)) memberIds.add(user.id);
  }
  return memberIds;
}

export async function getMarketingPushTokens(
  target: "feed" | "club" | "both" = "feed",
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const consented = await getUserIdsWithMarketingConsent();
  if (consented.size === 0) return [];

  let userIds = consented;
  if (target === "club") {
    const members = await getClubMemberUserIds();
    userIds = new Set([...consented].filter((id) => members.has(id)));
  }
  if (userIds.size === 0) return [];

  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(
      and(eq(pushTokens.enabled, true), inArray(pushTokens.userId, [...userIds]), isNull(users.blockedAt)),
    );

  return results.map((r) => r.token);
}

export async function getServicePushTokens(
  target: "feed" | "club" | "both" = "feed",
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  if (target === "club") {
    const memberIds = await getClubMemberUserIds();
    if (memberIds.size === 0) return [];
    const results = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .innerJoin(users, eq(users.id, pushTokens.userId))
      .where(
        and(
          eq(pushTokens.enabled, true),
          inArray(pushTokens.userId, [...memberIds]),
          isNull(users.blockedAt),
        ),
      );
    return results.map((r) => r.token);
  }

  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(eq(pushTokens.enabled, true), isNull(users.blockedAt)));

  return results.map((r) => r.token);
}

export async function deletePushTokensForUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function getLatestPublishedPost(
  target: "feed" | "club",
): Promise<{ id: number; text: string } | undefined> {
  return readLatestPublishedPost(await getDb(), target);
}

// ── Videos ──

// Get all published videos ordered by sortOrder
export async function getVideos(): Promise<Video[]> {
  return readVideos(await getDb());
}

// Public details must obey the same publication gate as the list.
export async function getVideoById(id: number): Promise<Video | undefined> {
  return readVideoById(await getDb(), id);
}

// Get video by YouTube ID (for dedup)
export async function getVideoByYoutubeId(youtubeId: string): Promise<Video | undefined> {
  return readVideoByYoutubeId(await getDb(), youtubeId);
}

// Create a video entry
export async function createVideo(data: InsertVideo): Promise<number> {
  return persistVideoCreation(await getDb(), data);
}

// Bulk import videos (skip duplicates)
export async function bulkImportVideos(items: InsertVideo[]): Promise<number> {
  return persistVideoImport(await getDb(), items);
}

// Update video
export async function updateVideo(id: number, data: Partial<InsertVideo>): Promise<void> {
  return persistVideoUpdate(await getDb(), id, data);
}

// Delete video
export async function deleteVideo(id: number): Promise<void> {
  return persistVideoDeletion(await getDb(), id);
}

// ── Enhanced Admin: Post queries with target/status ──

// Get published posts for a specific target (feed or club)
export async function getPostsForTarget(target: "feed" | "club", options?: {
  tagFilter?: string;
  search?: string;
  limit?: number;
  cursor?: number;
}): Promise<{ posts: (Post & { likeCount: number })[]; nextCursor: number | null }> {
  return readTargetPosts(await getDb(), target, options);
}

// Get admin posts with filters (all statuses)
export async function getAdminPostsFiltered(options?: {
  status?: "draft" | "scheduled" | "published";
  target?: "feed" | "club" | "both";
}): Promise<Post[]> {
  const db = await getDb();
  return readAdminPostsFiltered(db, options);
}

// Get scheduled posts (for calendar tracker)
export async function getScheduledPosts(): Promise<Post[]> {
  const db = await getDb();
  return readScheduledPosts(db);
}

// ── Post Media CRUD ──

export async function createPostMedia(data: InsertPostMedia): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(postMedia).values(data);
  return Number(result[0].insertId);
}

export async function getPostMediaByPostId(postId: number): Promise<PostMedia[]> {
  const db = await getDb();
  return readPostMediaByPostId(db, postId);
}

export async function deletePostMediaById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(postMedia).where(eq(postMedia.id, id));
}

export async function deletePostMediaByPostId(postId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(postMedia).where(eq(postMedia.postId, postId));
}

export async function replacePostVideos(postId: number, urls: string[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use the same post lock and transaction as the canonical edit path.
  await persistPostEdit(db, postId, {}, urls);
}

export async function clearRawCameraFilenames(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(postMedia)
    .set({ filename: null })
    .where(sql`${postMedia.filename} REGEXP '^(IMG|DSC|VID|MOV|PXL|Screenshot|Photo|Video)[-_ ]?[0-9]'`);
}

// Update post status (for confirming scheduled posts)
export async function confirmScheduledPost(postId: number): Promise<PostPublication | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return confirmPostPublication(db, postId);
}

export async function publishDueScheduledPosts(): Promise<{ id: number; text: string; target: "feed" | "club" | "both" }[]> {
  const db = await getDb();
  if (!db) return [];

  return db.transaction(async (tx) => {
    // Claim the current rows before changing them. Another scheduler/admin
    // holding a row leaves it for a later tick, never a stale announcement.
    const due = await tx
      .select({ id: posts.id, text: posts.text, target: posts.target })
      .from(posts)
      .where(and(
        eq(posts.status, "scheduled"),
        isNotNull(posts.scheduledAt),
        lte(posts.scheduledAt, new Date()),
      ))
      .orderBy(asc(posts.id))
      .for("update", { skipLocked: true });

    if (due.length === 0) return [];

    await tx.update(posts).set({
      status: "published",
      published: true,
      publishedAt: sql`COALESCE(${posts.publishedAt}, ${posts.scheduledAt}, UTC_TIMESTAMP())`,
    }).where(inArray(posts.id, due.map((post) => post.id)));

    // The transaction resolves only after commit; callers announce this batch.
    return due;
  });
}

// ── Post Statistics (admin dashboard) ──
export interface PostStatistics {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  feedPosts: number;
  clubPosts: number;
  bothPosts: number;
  totalLikes: number;
  totalSaves: number;
  postsThisMonth: number;
  postsLastMonth: number;
  topLikedPosts: { id: number; text: string; likeCount: number }[];
}

export async function getPostStatistics(): Promise<PostStatistics> {
  const db = await getDb();
  return readPostStatistics(db);
}

// ── Pen pals ──

export type PenPalMatchCard = {
  userId: number;
  name: string | null;
  avatarUrl: string | null;
  city: string;
  address: string;
  interests: string[];
  sharedInterests: string[];
};

function asInterestList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function getPenPalProfile(userId: number): Promise<PenPalProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(penPalProfiles).where(eq(penPalProfiles.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertPenPalProfile(userId: number, data: { city: string; interests: string[]; address: string }): Promise<PenPalProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(penPalProfiles).values({
    userId,
    city: data.city,
    interests: data.interests,
    address: data.address,
    active: true,
  }).onDuplicateKeyUpdate({
    set: {
      city: data.city,
      interests: data.interests,
      address: data.address,
      active: true,
    },
  });

  const saved = await getPenPalProfile(userId);
  if (!saved) throw new Error("Failed to save pen pal profile");
  return saved;
}

export async function deactivatePenPalProfile(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(penPalProfiles).set({ active: false }).where(eq(penPalProfiles.userId, userId));
}

export async function findPenPalMatches(userId: number, limit = 2): Promise<PenPalMatchCard[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const mine = await getPenPalProfile(userId);
  if (!mine || !mine.active) return [];

  const myInterests = asInterestList(mine.interests);
  const [others, shownRows] = await Promise.all([
    db.select().from(penPalProfiles).where(and(eq(penPalProfiles.active, true), ne(penPalProfiles.userId, userId))),
    db.select({ matchUserId: penPalShown.matchUserId }).from(penPalShown).where(eq(penPalShown.userId, userId)),
  ]);
  const shown = new Set(shownRows.map((row) => row.matchUserId));

  const ranked = others
    .filter((profile) => !shown.has(profile.userId))
    .map((profile) => {
      const interests = asInterestList(profile.interests);
      const sharedInterests = interests.filter((interest) => myInterests.includes(interest));
      return { profile, interests, sharedInterests, score: sharedInterests.length };
    })
    .filter((row) => row.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length === 0) return [];

  for (const row of ranked) {
    try {
      await db.insert(penPalShown).values({ userId, matchUserId: row.profile.userId });
    } catch {
      // already recorded for this pair
    }
  }

  const matchIds = ranked.map((row) => row.profile.userId);
  const matchUsers = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, matchIds));
  const userById = new Map(matchUsers.map((user) => [user.id, user]));

  return ranked.map((row) => {
    const user = userById.get(row.profile.userId);
    return {
      userId: row.profile.userId,
      name: user?.name ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      city: row.profile.city,
      address: row.profile.address,
      interests: row.interests,
      sharedInterests: row.sharedInterests,
    };
  });
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

const CLUB_ACCESS_MS = 31 * 24 * 60 * 60 * 1000;

export async function settleClubPayment(input: Parameters<typeof settleClubOrder>[1]) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return settleClubOrder(database, input);
}

export async function createClubPayment(data: { userId: number; orderId: string; email?: string | null; sum:string }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(clubPayments).values({
    userId: data.userId,
    orderId: data.orderId,
    email: data.email ?? null,
    status: "pending",
    sum: data.sum,
  });
}

export async function getClubPaymentByOrderId(orderId: string): Promise<ClubPayment | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(clubPayments).where(eq(clubPayments.orderId, orderId)).limit(1);
  return rows[0];
}

export async function getActiveClubSubscription(userId: number): Promise<ClubPayment | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(clubPayments)
    .where(and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")))
    .orderBy(desc(clubPayments.expiresAt));
  const now = Date.now();
  return rows.find((row) => row.expiresAt && new Date(row.expiresAt).getTime() > now);
}

export async function getLatestClubExpiry(userId: number): Promise<Date | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ expiresAt: clubPayments.expiresAt })
    .from(clubPayments)
    .where(and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")))
    .orderBy(desc(clubPayments.expiresAt))
    .limit(1);
  return rows[0]?.expiresAt ? new Date(rows[0].expiresAt) : null;
}

export async function nextClubExpiry(userId: number, periodMs = CLUB_ACCESS_MS): Promise<Date> {
  const active = await getActiveClubSubscription(userId);
  const currentEnd = active?.expiresAt ? new Date(active.expiresAt).getTime() : 0;
  const baseMs = Math.max(Date.now(), currentEnd);
  return new Date(baseMs + periodMs);
}

export async function grantClubDays(userId: number, days = 31): Promise<Date> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return grantClubAccess(database, userId, days);
}

export async function markClubPaymentPaid(data: {
  userId: number;
  orderId: string;
  email?: string | null;
  sum?: string | null;
  expiresAt: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(clubPayments).where(eq(clubPayments.orderId, data.orderId)).limit(1);
  if (existing[0]) {
    await db.update(clubPayments).set({
      status: "paid",
      paidAt: new Date(),
      expiresAt: data.expiresAt,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      sum: data.sum ?? existing[0].sum,
      email: data.email ?? existing[0].email,
    }).where(eq(clubPayments.orderId, data.orderId));
    return;
  }

  await db.insert(clubPayments).values({
    userId: data.userId,
    orderId: data.orderId,
    email: data.email ?? null,
    sum: data.sum ?? null,
    status: "paid",
    paidAt: new Date(),
    expiresAt: data.expiresAt,
    cancelAtPeriodEnd: false,
  });
}

export async function cancelClubSubscription(userId: number): Promise<{ cancelled: boolean; expiresAt: Date | null }> {
  // Compatibility facade: local flags are never an alternative to provider confirmation.
  const database=await getDb();if(!database) throw new Error("Database not available");
  const {requestClubCancellation}=await import("./billing/cancellation");
  const {cancelProdamusSubscription}=await import("./prodamus");
  const result=await requestClubCancellation(database,userId,cancelProdamusSubscription);
  return {cancelled:result.confirmed,expiresAt:result.expiresAt};
}

export async function createShopPurchase(data: {
  userId?: number | null;
  productId: string;
  orderId: string;
  email?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(shopPurchases).values({
    userId: data.userId ?? null,
    productId: data.productId,
    orderId: data.orderId,
    email: data.email ?? null,
    status: "pending",
  });
}

export async function getShopPurchaseByOrderId(orderId: string): Promise<ShopPurchase | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(shopPurchases).where(eq(shopPurchases.orderId, orderId)).limit(1);
  return rows[0];
}

export async function markShopPurchasePaid(data: {
  userId?: number | null;
  productId: string;
  orderId: string;
  email?: string | null;
  sum?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(shopPurchases).where(eq(shopPurchases.orderId, data.orderId)).limit(1);
  if (existing[0]) {
    await db.update(shopPurchases).set({
      status: "paid",
      paidAt: new Date(),
      sum: data.sum ?? existing[0].sum,
      email: data.email ?? existing[0].email,
      userId: data.userId ?? existing[0].userId,
      productId: data.productId || existing[0].productId,
    }).where(eq(shopPurchases.orderId, data.orderId));
    return;
  }
  await db.insert(shopPurchases).values({
    userId: data.userId ?? null,
    productId: data.productId,
    orderId: data.orderId,
    email: data.email ?? null,
    sum: data.sum ?? null,
    status: "paid",
    paidAt: new Date(),
  });
}

export async function userOwnsShopProduct(userId: number, productId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(shopPurchases)
    .where(and(eq(shopPurchases.userId, userId), eq(shopPurchases.productId, productId), eq(shopPurchases.status, "paid")))
    .limit(1);
  return Boolean(rows[0]);
}


export async function listPublishedArticles(): Promise<Article[]> {
  const db = await getDb();
  return readPublishedArticles(db);
}

export async function listAllArticles(): Promise<Article[]> {
  const db = await getDb();
  return readAllArticles(db);
}

export async function getArticleById(id: number): Promise<Article | undefined> {
  const db = await getDb();
  return readArticleById(db, id);
}

export async function createArticle(data: CreateArticleInput): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistArticleCreation(db, data);
}

export async function updateArticle(id: number, data: UpdateArticleInput): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await persistArticleUpdate(db, id, data);
}

export async function deleteArticle(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await persistArticleDeletion(db, id);
}
