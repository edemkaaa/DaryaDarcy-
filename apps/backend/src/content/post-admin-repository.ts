import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  posts,
  likes,
  savedPosts,
  type Post,
  type PostMedia,
} from "../../../../packages/database/src/schema";
import { attachPostMedia } from "./post-media-repository";
import { postDateOrder, postListOrder } from "./post-order";

// db.ts owns the connection; the native admin boundary owns access checks.
// These projections deliberately retain hidden posts and legacy row counts.
type Database = MySql2Database | null;

export async function getAllPostsAdmin(
  db: Database,
): Promise<(Post & { media: PostMedia[] })[]> {
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(posts)
    .orderBy(...postListOrder);
  return attachPostMedia(db, rows);
}

export async function getAdminPostsFiltered(
  db: Database,
  options?: {
    status?: "draft" | "scheduled" | "published";
    target?: "feed" | "club" | "both";
  },
): Promise<Post[]> {
  if (!db) throw new Error("Database not available");

  let conditions = [];
  if (options?.status) conditions.push(eq(posts.status, options.status));
  if (options?.target) conditions.push(eq(posts.target, options.target));

  const query =
    conditions.length > 0
      ? db
          .select()
          .from(posts)
          .where(and(...conditions))
          .orderBy(postDateOrder)
      : db.select().from(posts).orderBy(postDateOrder);

  return query;
}

export async function getScheduledPosts(db: Database): Promise<Post[]> {
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(posts)
    .where(eq(posts.status, "scheduled"))
    .orderBy(asc(posts.scheduledAt));
}

export async function getPostStatistics(db: Database) {
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Return one aggregate row, not the entire archive and its text/media fields.
  const [counts] = await db
    .select({
      totalPosts: sql<number>`COUNT(*)`,
      publishedPosts: sql<number>`COUNT(CASE WHEN ${posts.status} = 'published' THEN 1 END)`,
      scheduledPosts: sql<number>`COUNT(CASE WHEN ${posts.status} = 'scheduled' THEN 1 END)`,
      draftPosts: sql<number>`COUNT(CASE WHEN ${posts.status} = 'draft' THEN 1 END)`,
      feedPosts: sql<number>`COUNT(CASE WHEN ${posts.target} = 'feed' THEN 1 END)`,
      clubPosts: sql<number>`COUNT(CASE WHEN ${posts.target} = 'club' THEN 1 END)`,
      bothPosts: sql<number>`COUNT(CASE WHEN ${posts.target} = 'both' THEN 1 END)`,
      postsThisMonth: sql<number>`COUNT(CASE WHEN ${posts.createdAt} >= ${startOfMonth} THEN 1 END)`,
      postsLastMonth: sql<number>`COUNT(CASE WHEN ${posts.createdAt} >= ${startOfLastMonth} AND ${posts.createdAt} < ${startOfMonth} THEN 1 END)`,
    })
    .from(posts);

  // Count total likes
  const likesResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(likes);
  const totalLikes = Number(likesResult[0]?.count ?? 0);

  // Count total saves
  const savesResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(savedPosts);
  const totalSaves = Number(savesResult[0]?.count ?? 0);

  // Top liked posts (top 5)
  const postsWithLikes = await db
    .select({
      id: posts.id,
      text: posts.text,
      likeCount:
        sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as(
          "likeCount",
        ),
    })
    .from(posts)
    .orderBy(desc(sql`likeCount`))
    .limit(5);

  const topLikedPosts = postsWithLikes.map((p) => ({
    id: p.id,
    text: p.text.slice(0, 80),
    likeCount: Number(p.likeCount),
  }));

  return {
    totalPosts: Number(counts.totalPosts),
    publishedPosts: Number(counts.publishedPosts),
    scheduledPosts: Number(counts.scheduledPosts),
    draftPosts: Number(counts.draftPosts),
    feedPosts: Number(counts.feedPosts),
    clubPosts: Number(counts.clubPosts),
    bothPosts: Number(counts.bothPosts),
    totalLikes,
    totalSaves,
    postsThisMonth: Number(counts.postsThisMonth),
    postsLastMonth: Number(counts.postsLastMonth),
    topLikedPosts,
  };
}
