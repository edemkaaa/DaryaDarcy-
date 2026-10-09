import { and, eq, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { posts, type Post } from "../../../../packages/database/src/schema";
import { attachPostMedia } from "./post-media-repository";
import { postDateOrder } from "./post-order";

// Connection ownership stays in db.ts; services gate private detail and club text.
type Database = MySql2Database | null;

export async function getPostById(
  db: Database,
  id: number,
): Promise<(Post & { likeCount: number }) | undefined> {
  if (!db) throw new Error("Database not available");

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
      likeCount:
        sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as(
          "likeCount",
        ),
    })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);

  const row = result[0];
  if (!row) return undefined;
  const [withMedia] = await attachPostMedia(db, [row]);
  return withMedia;
}

export async function getLatestPublishedPost(
  db: Database,
  target: "feed" | "club",
): Promise<{ id: number; text: string } | undefined> {
  if (!db) return undefined;
  const rows = await db
    .select({ id: posts.id, text: posts.text })
    .from(posts)
    .where(
      and(
        eq(posts.published, true),
        eq(posts.status, "published"),
        or(eq(posts.target, target), eq(posts.target, "both")),
      ),
    )
    .orderBy(postDateOrder)
    .limit(1);
  return rows[0];
}
