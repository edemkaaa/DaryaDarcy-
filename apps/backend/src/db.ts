import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { settleClubOrder } from "./billing/settlement";
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
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
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
    return;
  }

  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.gender !== undefined) updateSet.gender = data.gender;
  if (data.avatarUrl !== undefined) updateSet.avatarUrl = data.avatarUrl;

  if (Object.keys(updateSet).length === 0) return;

  await db.update(users).set(updateSet).where(eq(users.id, userId));
}

// ── Feed queries ──

import { posts, tags, likes, savedPosts, videos, Post, InsertPost, Tag, Video, InsertVideo, penPalProfiles, penPalShown, PenPalProfile, clubPayments, ClubPayment, shopPurchases, ShopPurchase, postComments, commentLikes, commentReports, articles, Article, ArticleBlock } from "../../../packages/database/src/schema";
import { normalizeArticleBlocks } from "../../../packages/shared/src/article-blocks";
import { desc, asc, and, sql, or, ne, gte, lte, isNotNull, isNull } from "drizzle-orm";

const postDateOrder = desc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`);
const postListOrder = [asc(posts.sortOrder), postDateOrder] as const;

// Get all published posts, optionally filtered by tag
export async function getPosts(tagFilter?: string): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      id: posts.id,
      text: posts.text,
      photos: posts.photos,
      tags: posts.tags,
      source: posts.source,
      instagramId: posts.instagramId,
      sortOrder: posts.sortOrder,
      published: posts.published,
      status: posts.status,
      target: posts.target,
      scheduledAt: posts.scheduledAt,
      publishedAt: posts.publishedAt,
      richText: posts.richText,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as("likeCount"),
    })
    .from(posts)
    .where(and(eq(posts.published, true), eq(posts.status, "published"), or(eq(posts.target, "feed"), eq(posts.target, "both"))))
    .orderBy(...postListOrder);

  const results = await query;

  let filtered = results;
  if (tagFilter && tagFilter !== "all") {
    filtered = results.filter((p) => {
      const postTags = p.tags as string[];
      return postTags.includes(tagFilter);
    });
  }

  return attachPostMedia(db, filtered);
}

const postListColumns = {
  id: posts.id,
  text: posts.text,
  photos: posts.photos,
  tags: posts.tags,
  source: posts.source,
  instagramId: posts.instagramId,
  sortOrder: posts.sortOrder,
  published: posts.published,
  status: posts.status,
  target: posts.target,
  scheduledAt: posts.scheduledAt,
  publishedAt: posts.publishedAt,
  richText: posts.richText,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as("likeCount"),
  commentCount: sql<number>`(SELECT COUNT(*) FROM post_comments WHERE post_comments.postId = posts.id)`.as("commentCount"),
};

async function attachPostMedia<T extends { id: number }>(
  db: Db,
  page: T[],
): Promise<(T & { media: PostMedia[] })[]> {
  if (page.length === 0) return [];
  try {
    const mediaRows = await db
      .select()
      .from(postMedia)
      .where(inArray(postMedia.postId, page.map((p) => p.id)))
      .orderBy(asc(postMedia.sortOrder));
    const byPost = new Map<number, PostMedia[]>();
    for (const row of mediaRows) {
      const list = byPost.get(row.postId) ?? [];
      list.push(row);
      byPost.set(row.postId, list);
    }
    return page.map((p) => ({ ...p, media: byPost.get(p.id) ?? [] }));
  } catch (error) {
    console.warn("[Feed] post_media query failed");
    return page.map((p) => ({ ...p, media: [] as PostMedia[] }));
  }
}

function feedFilterConditions(options: { tagFilter?: string; search?: string }) {
  const conditions = [
    eq(posts.published, true),
    eq(posts.status, "published"),
    or(eq(posts.target, "feed"), eq(posts.target, "both")),
  ];
  if (options.tagFilter && options.tagFilter !== "all") {
    conditions.push(sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${options.tagFilter}))`);
  }
  if (options.search && options.search.trim().length > 0) {
    const query = `%${options.search.trim().toLowerCase()}%`;
    conditions.push(sql`LOWER(${posts.text}) LIKE ${query}`);
  }
  return conditions;
}

// Get paginated published posts (offset-based with SQL limit)
export async function getPostsPaginated(options: {
  tagFilter?: string;
  search?: string;
  limit: number;
  cursor?: number; // offset (page number * limit)
}): Promise<{ posts: (Post & { likeCount: number; media: PostMedia[] })[]; nextCursor: number | null }> {
  const db = await getDb();
  if (!db) return { posts: [], nextCursor: null };

  const offset = options.cursor ?? 0;
  const rows = await db
    .select(postListColumns)
    .from(posts)
    .where(and(...feedFilterConditions(options)))
    .orderBy(...postListOrder)
    .limit(options.limit + 1)
    .offset(offset);

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  return {
    posts: await attachPostMedia(db, page),
    nextCursor: hasMore ? offset + options.limit : null,
  };
}

// Get a single post by ID
export async function getPostById(id: number): Promise<(Post & { likeCount: number }) | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      id: posts.id,
      text: posts.text,
      photos: posts.photos,
      tags: posts.tags,
      source: posts.source,
      instagramId: posts.instagramId,
      sortOrder: posts.sortOrder,
      published: posts.published,
      status: posts.status,
      target: posts.target,
      scheduledAt: posts.scheduledAt,
      publishedAt: posts.publishedAt,
      richText: posts.richText,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as("likeCount"),
    })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);

  const row = result[0];
  if (!row) return undefined;
  const [withMedia] = await attachPostMedia(db, [row]);
  return withMedia;
}

// Get all tags ordered by sortOrder
export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(tags).orderBy(asc(tags.sortOrder));
  } catch (error) {
    console.error("[Feed] getAllTags failed");
    throw error;
  }
}

// Toggle like on a post
export async function toggleLike(userId: number, postId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    return false; // unliked
  } else {
    await db.insert(likes).values({ userId, postId });
    return true; // liked
  }
}

// Toggle save/bookmark on a post
export async function toggleSave(userId: number, postId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(savedPosts)
    .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(savedPosts).where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)));
    return false; // unsaved
  } else {
    await db.insert(savedPosts).values({ userId, postId });
    return true; // saved
  }
}

// Get user's liked post IDs
export async function getUserLikedPostIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({ postId: likes.postId }).from(likes).where(eq(likes.userId, userId));
  return result.map((r) => r.postId);
}

// Get user's saved post IDs
export async function getUserSavedPostIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({ postId: savedPosts.postId })
    .from(savedPosts)
    .where(eq(savedPosts.userId, userId))
    .orderBy(desc(savedPosts.createdAt));
  return result.map((r) => r.postId);
}

export async function getPostsByIds(ids: number[]): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  const rows = await db.select(postListColumns).from(posts).where(and(inArray(posts.id, ids), eq(posts.published, true), eq(posts.status, "published")));
  const withMedia = await attachPostMedia(db, rows);
  const byId = new Map(withMedia.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
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
  if (!db) return [];
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      blockedAt: users.blockedAt,
      blockedReason: users.blockedReason,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  const payments = await db
    .select()
    .from(clubPayments)
    .where(eq(clubPayments.status, "paid"));
  const now = Date.now();
  const expiresByUser = new Map<number, Date>();
  for (const row of payments) {
    if (!row.expiresAt) continue;
    if (new Date(row.expiresAt).getTime() <= now) continue;
    const current = expiresByUser.get(row.userId);
    if (!current || new Date(row.expiresAt) > current) {
      expiresByUser.set(row.userId, new Date(row.expiresAt));
    }
  }
  return allUsers.map((user) => ({
    ...user,
    clubExpiresAt: expiresByUser.get(user.id) ?? null,
  }));
}

export async function listAdminPayments(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clubPayments).orderBy(desc(clubPayments.createdAt)).limit(limit);
}

// ── Admin: Post CRUD ──

export async function createPost(data: InsertPost): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(posts).values(data);
  return Number(result[0].insertId);
}

export async function updatePost(id: number, data: Partial<InsertPost>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(posts).set(data).where(eq(posts.id, id));
}

export async function deletePost(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async tx => {
    await tx.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).for("update");
    const comments = await tx.select({ id: postComments.id }).from(postComments).where(eq(postComments.postId, id)).orderBy(asc(postComments.id)).for("update");
    const commentIds = comments.map(comment => comment.id);
    if (commentIds.length) {
      await tx.update(postComments).set({ parentId: null }).where(inArray(postComments.parentId, commentIds));
      await tx.delete(commentLikes).where(inArray(commentLikes.commentId, commentIds));
      await tx.delete(commentReports).where(inArray(commentReports.commentId, commentIds));
    }
    await tx.delete(likes).where(eq(likes.postId, id));
    await tx.delete(savedPosts).where(eq(savedPosts.postId, id));
    await tx.delete(postMedia).where(eq(postMedia.postId, id));
    await tx.delete(postComments).where(eq(postComments.postId, id));
    await tx.delete(posts).where(eq(posts.id, id));
  });
}

// Get all posts for admin (including unpublished)
export async function getAllPostsAdmin(): Promise<(Post & { media: PostMedia[] })[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(posts).orderBy(...postListOrder);
  return attachPostMedia(db, rows);
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

export async function upsertArticleTeaser(article: {
  id: number;
  title: string;
  coverUrl?: string | null;
  access: "public" | "club";
  published: boolean;
}): Promise<void> {
  const source = `article:${article.id}`;
  const existing = await getPostBySource(source);
  if (!article.published) {
    if (existing) await deletePost(existing.id);
    return;
  }
  const payload = {
    text: article.title,
    photos: article.coverUrl ? [article.coverUrl] : [],
    tags: ["exclusive"],
    source,
    target: "club" as const,
    published: true,
    status: "published" as const,
  };
  if (existing) {
    await updatePost(existing.id, payload);
    return;
  }
  await createPost(payload);
}

// ── Push Tokens ──

export async function registerPushToken(token: string, userId?: number, platform?: string) {
  const db = await getDb();
  if (!db) return;

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
  if (!db) return;

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
  if (!db) return;
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function getLatestPublishedPost(
  target: "feed" | "club",
): Promise<{ id: number; text: string } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ id: posts.id, text: posts.text })
    .from(posts)
    .where(and(
      eq(posts.published, true),
      eq(posts.status, "published"),
      or(eq(posts.target, target), eq(posts.target, "both")),
    ))
    .orderBy(postDateOrder)
    .limit(1);
  return rows[0];
}

// ── Videos ──

// Get all published videos ordered by sortOrder
export async function getVideos(): Promise<Video[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(videos)
    .where(eq(videos.published, true))
    .orderBy(asc(videos.sortOrder), desc(videos.createdAt));
  return rows.map((row) => ({ ...row, title: (row.title || "").normalize("NFC") }));
}

// Get single video by ID
export async function getVideoById(id: number): Promise<Video | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  const row = result[0];
  if (!row) return undefined;
  return { ...row, title: (row.title || "").normalize("NFC") };
}

// Get video by YouTube ID (for dedup)
export async function getVideoByYoutubeId(youtubeId: string): Promise<Video | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(videos).where(eq(videos.youtubeId, youtubeId)).limit(1);
  return result[0];
}

// Create a video entry
export async function createVideo(data: InsertVideo): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(videos).values(data);
  return Number(result[0].insertId);
}

// Bulk import videos (skip duplicates)
export async function bulkImportVideos(items: InsertVideo[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let imported = 0;
  for (const item of items) {
    const existing = await getVideoByYoutubeId(item.youtubeId);
    if (existing) continue;
    await db.insert(videos).values(item);
    imported++;
  }
  return imported;
}

// Update video
export async function updateVideo(id: number, data: Partial<InsertVideo>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(videos).set(data).where(eq(videos.id, id));
}

// Delete video
export async function deleteVideo(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(videos).where(eq(videos.id, id));
}

// ── Enhanced Admin: Post queries with target/status ──

// Get published posts for a specific target (feed or club)
export async function getPostsForTarget(target: "feed" | "club", options?: {
  tagFilter?: string;
  search?: string;
  limit?: number;
  cursor?: number;
}): Promise<{ posts: (Post & { likeCount: number })[]; nextCursor: number | null }> {
  const db = await getDb();
  if (!db) return { posts: [], nextCursor: null };

  const offset = options?.cursor ?? 0;
  const limit = options?.limit ?? 20;
  const conditions = [
    eq(posts.published, true),
    eq(posts.status, "published"),
    or(eq(posts.target, target), eq(posts.target, "both")),
  ];
  if (options?.tagFilter && options.tagFilter !== "all") {
    conditions.push(sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${options.tagFilter}))`);
  }
  if (options?.search && options.search.trim().length > 0) {
    const query = `%${options.search.trim().toLowerCase()}%`;
    conditions.push(sql`LOWER(${posts.text}) LIKE ${query}`);
  }

  const rows = await db
    .select(postListColumns)
    .from(posts)
    .where(and(...conditions))
    .orderBy(...postListOrder)
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    posts: await attachPostMedia(db, page),
    nextCursor: hasMore ? offset + limit : null,
  };
}

// Get admin posts with filters (all statuses)
export async function getAdminPostsFiltered(options?: {
  status?: "draft" | "scheduled" | "published";
  target?: "feed" | "club" | "both";
}): Promise<Post[]> {
  const db = await getDb();
  if (!db) return [];

  let conditions = [];
  if (options?.status) conditions.push(eq(posts.status, options.status));
  if (options?.target) conditions.push(eq(posts.target, options.target));

  const query = conditions.length > 0
    ? db.select().from(posts).where(and(...conditions)).orderBy(postDateOrder)
    : db.select().from(posts).orderBy(postDateOrder);

  return query;
}

// Get scheduled posts (for calendar tracker)
export async function getScheduledPosts(): Promise<Post[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(posts)
    .where(eq(posts.status, "scheduled"))
    .orderBy(asc(posts.scheduledAt));
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
  if (!db) return [];

  return db
    .select()
    .from(postMedia)
    .where(eq(postMedia.postId, postId))
    .orderBy(asc(postMedia.sortOrder));
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

function videoFilenameFromUrl(url: string): string | null {
  const base = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "");
  return base || null;
}

export async function replacePostVideos(postId: number, urls: string[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(postMedia).where(and(eq(postMedia.postId, postId), eq(postMedia.type, "video")));
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]?.trim();
    if (!url) continue;
    await db.insert(postMedia).values({
      postId,
      type: "video",
      url,
      filename: videoFilenameFromUrl(url),
      mimeType: "video/mp4",
      sortOrder: i,
    });
  }
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
export async function confirmScheduledPost(postId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(posts).set({
    status: "published",
    published: true,
    publishedAt: sql`COALESCE(${posts.publishedAt}, UTC_TIMESTAMP())`,
  }).where(eq(posts.id, postId));
}

export async function publishDueScheduledPosts(): Promise<{ id: number; text: string; target: "feed" | "club" | "both" }[]> {
  const db = await getDb();
  if (!db) return [];

  const due = await db
    .select({ id: posts.id, text: posts.text, target: posts.target })
    .from(posts)
    .where(and(
      eq(posts.status, "scheduled"),
      isNotNull(posts.scheduledAt),
      lte(posts.scheduledAt, new Date()),
    ));

  if (due.length === 0) return [];

  await db.update(posts).set({
    status: "published",
    published: true,
    publishedAt: sql`COALESCE(${posts.publishedAt}, ${posts.scheduledAt}, UTC_TIMESTAMP())`,
  }).where(and(
    eq(posts.status, "scheduled"),
    isNotNull(posts.scheduledAt),
    lte(posts.scheduledAt, new Date()),
  ));

  return due;
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
  if (!db) {
    return {
      totalPosts: 0, publishedPosts: 0, scheduledPosts: 0, draftPosts: 0,
      feedPosts: 0, clubPosts: 0, bothPosts: 0,
      totalLikes: 0, totalSaves: 0,
      postsThisMonth: 0, postsLastMonth: 0,
      topLikedPosts: [],
    };
  }

  // Get all posts
  const allPosts = await db.select().from(posts);

  const totalPosts = allPosts.length;
  const publishedPosts = allPosts.filter(p => p.status === "published").length;
  const scheduledPostsCount = allPosts.filter(p => p.status === "scheduled").length;
  const draftPosts = allPosts.filter(p => p.status === "draft").length;
  const feedPosts = allPosts.filter(p => p.target === "feed").length;
  const clubPosts = allPosts.filter(p => p.target === "club").length;
  const bothPosts = allPosts.filter(p => p.target === "both").length;

  // Count total likes
  const likesResult = await db.select({ count: sql<number>`COUNT(*)` }).from(likes);
  const totalLikes = Number(likesResult[0]?.count ?? 0);

  // Count total saves
  const savesResult = await db.select({ count: sql<number>`COUNT(*)` }).from(savedPosts);
  const totalSaves = Number(savesResult[0]?.count ?? 0);

  // Posts this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const postsThisMonth = allPosts.filter(p => new Date(p.createdAt) >= startOfMonth).length;
  const postsLastMonth = allPosts.filter(p => {
    const d = new Date(p.createdAt);
    return d >= startOfLastMonth && d < startOfMonth;
  }).length;

  // Top liked posts (top 5)
  const postsWithLikes = await db
    .select({
      id: posts.id,
      text: posts.text,
      likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as("likeCount"),
    })
    .from(posts)
    .orderBy(desc(sql`likeCount`))
    .limit(5);

  const topLikedPosts = postsWithLikes.map(p => ({
    id: p.id,
    text: p.text.slice(0, 80),
    likeCount: Number(p.likeCount),
  }));

  return {
    totalPosts,
    publishedPosts,
    scheduledPosts: scheduledPostsCount,
    draftPosts,
    feedPosts,
    clubPosts,
    bothPosts,
    totalLikes,
    totalSaves,
    postsThisMonth,
    postsLastMonth,
    topLikedPosts,
  };
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
  const user = await getUserById(userId);
  if (!user) throw new Error("Пользователь не найден");
  const expiresAt = await nextClubExpiry(userId, days * 24 * 60 * 60 * 1000);
  await markClubPaymentPaid({
    userId,
    orderId: `admin-grant-${userId}-${Date.now()}`,
    email: user.email,
    sum: "0",
    expiresAt,
  });
  return expiresAt;
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


function asArticleSections(value: unknown): ArticleBlock[] {
  return normalizeArticleBlocks(value).filter((block) => {
    if (block.type === "photo" || block.type === "png") return Boolean(block.url);
    if (block.type === "link") return Boolean(block.url);
    if (block.type === "carousel") return Boolean(block.urls?.length);
    return Boolean(block.text?.trim());
  });
}

export async function listPublishedArticles(): Promise<Article[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.published, true))
    .orderBy(asc(articles.sortOrder), desc(articles.createdAt));
  return rows.map((row) => ({ ...row, sections: normalizeArticleBlocks(row.sections) }));
}

export async function listAllArticles(): Promise<Article[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(articles).orderBy(asc(articles.sortOrder), desc(articles.createdAt));
  return rows.map((row) => ({ ...row, sections: normalizeArticleBlocks(row.sections) }));
}

export async function getArticleById(id: number): Promise<Article | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { ...row, sections: normalizeArticleBlocks(row.sections) };
}

export async function createArticle(data: {
  title: string;
  coverUrl?: string | null;
  access: "public" | "club";
  published: boolean;
  sortOrder?: number;
  sections: ArticleBlock[];
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(articles).values({
    title: data.title,
    coverUrl: data.coverUrl ?? null,
    access: data.access,
    published: data.published,
    sortOrder: data.sortOrder ?? 0,
    sections: asArticleSections(data.sections),
  });
  return Number(result[0].insertId);
}

export async function updateArticle(id: number, data: Partial<{
  title: string;
  coverUrl: string | null;
  access: "public" | "club";
  published: boolean;
  sortOrder: number;
  sections: ArticleBlock[];
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patch: Record<string, unknown> = { ...data };
  if (data.sections) patch.sections = asArticleSections(data.sections);
  await db.update(articles).set(patch).where(eq(articles.id, id));
}

export async function deleteArticle(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const teaser = await getPostBySource(`article:${id}`);
  if (teaser) await deletePost(teaser.id);
  await db.delete(articles).where(eq(articles.id, id));
}
