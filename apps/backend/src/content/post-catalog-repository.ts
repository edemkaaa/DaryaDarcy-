import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  posts,
  type Post,
  type PostMedia,
} from "../../../../packages/database/src/schema";
import { attachPostMedia } from "./post-media-repository";
import { postListOrder } from "./post-order";

// db.ts owns the connection; services and adapters retain access decisions.
type Database = MySql2Database | null;
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
  likeCount:
    sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as(
      "likeCount",
    ),
  commentCount:
    sql<number>`(SELECT COUNT(*) FROM post_comments WHERE post_comments.postId = posts.id)`.as(
      "commentCount",
    ),
};

function feedFilterConditions(options: {
  tagFilter?: string;
  search?: string;
}) {
  const conditions = [
    eq(posts.published, true),
    eq(posts.status, "published"),
    or(eq(posts.target, "feed"), eq(posts.target, "both")),
  ];
  if (options.tagFilter && options.tagFilter !== "all") {
    conditions.push(
      sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${options.tagFilter}))`,
    );
  }
  if (options.search && options.search.trim().length > 0) {
    const query = `%${options.search.trim().toLowerCase()}%`;
    conditions.push(sql`LOWER(${posts.text}) LIKE ${query}`);
  }
  return conditions;
}

export async function getPostsPaginated(
  db: Database,
  options: {
    tagFilter?: string;
    search?: string;
    limit: number;
    cursor?: number; // offset (page number * limit)
  },
): Promise<{
  posts: (Post & { likeCount: number; media: PostMedia[] })[];
  nextCursor: number | null;
}> {
  if (!db) throw new Error("Database not available");

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

export async function getPostsByIds(
  db: Database,
  ids: number[],
): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  if (ids.length === 0) return [];
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select(postListColumns)
    .from(posts)
    .where(
      and(
        inArray(posts.id, ids),
        eq(posts.published, true),
        eq(posts.status, "published"),
      ),
    );
  const withMedia = await attachPostMedia(db, rows);
  const byId = new Map(withMedia.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getPostsForTarget(
  db: Database,
  target: "feed" | "club",
  options?: {
    tagFilter?: string;
    search?: string;
    limit?: number;
    cursor?: number;
  },
): Promise<{
  posts: (Post & { likeCount: number })[];
  nextCursor: number | null;
}> {
  if (!db) throw new Error("Database not available");

  const offset = options?.cursor ?? 0;
  const limit = options?.limit ?? 20;
  const conditions = [
    eq(posts.published, true),
    eq(posts.status, "published"),
    or(eq(posts.target, target), eq(posts.target, "both")),
  ];
  if (options?.tagFilter && options.tagFilter !== "all") {
    conditions.push(
      sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${options.tagFilter}))`,
    );
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
