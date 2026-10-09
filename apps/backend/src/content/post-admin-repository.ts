import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  posts,
  likes,
  savedPosts,
  type Post,
} from "../../../../packages/database/src/schema";
import { postDateOrder } from "./post-order";

// db.ts owns the connection; the native admin boundary owns access checks.
// These projections deliberately retain hidden posts and legacy row counts.
type Database = MySql2Database | null;

export async function getAdminPostsFiltered(
  db: Database,
  options?: {
    status?: "draft" | "scheduled" | "published";
    target?: "feed" | "club" | "both";
  },
): Promise<Post[]> {
  if (!db) return [];

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
  if (!db) return [];

  return db
    .select()
    .from(posts)
    .where(eq(posts.status, "scheduled"))
    .orderBy(asc(posts.scheduledAt));
}

export async function getPostStatistics(db: Database) {
  if (!db) {
    return {
      totalPosts: 0,
      publishedPosts: 0,
      scheduledPosts: 0,
      draftPosts: 0,
      feedPosts: 0,
      clubPosts: 0,
      bothPosts: 0,
      totalLikes: 0,
      totalSaves: 0,
      postsThisMonth: 0,
      postsLastMonth: 0,
      topLikedPosts: [],
    };
  }

  // Get all posts
  const allPosts = await db.select().from(posts);

  const totalPosts = allPosts.length;
  const publishedPosts = allPosts.filter(
    (p) => p.status === "published",
  ).length;
  const scheduledPostsCount = allPosts.filter(
    (p) => p.status === "scheduled",
  ).length;
  const draftPosts = allPosts.filter((p) => p.status === "draft").length;
  const feedPosts = allPosts.filter((p) => p.target === "feed").length;
  const clubPosts = allPosts.filter((p) => p.target === "club").length;
  const bothPosts = allPosts.filter((p) => p.target === "both").length;

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

  // Posts this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const postsThisMonth = allPosts.filter(
    (p) => new Date(p.createdAt) >= startOfMonth,
  ).length;
  const postsLastMonth = allPosts.filter((p) => {
    const d = new Date(p.createdAt);
    return d >= startOfLastMonth && d < startOfMonth;
  }).length;

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
