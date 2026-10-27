import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { requireContentDatabase } from "./read-database";
import {
  posts,
  tags,
  type Post,
  type PostMedia,
  type Tag,
} from "../../../../packages/database/src/schema";
import { attachPostMedia } from "./post-media-repository";
import { clubPostListOrder, postListOrder } from "./post-order";
import { clubCategoryCondition, clubBoardTagCondition } from "./club-category-filter";
import type { ClubTabId } from "../../../../packages/shared/src/club-tags";

// db.ts owns the connection; services and adapters retain access decisions.
type Database = MySql2Database | null;

// The full reference catalog includes tags not yet used by published posts.
export async function getAllTags(db: Database): Promise<Tag[]> {
  requireContentDatabase(db);

  try {
    return await db.select().from(tags).orderBy(asc(tags.sortOrder));
  } catch (error) {
    console.error("[Feed] getAllTags failed");
    throw error;
  }
}

// Legacy list keeps its own fields and exact JavaScript tag membership.
export async function getPosts(
  db: Database,
  tagFilter?: string,
): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  if (!db) throw new Error("Database not available");

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
      likeCount:
        sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as(
          "likeCount",
        ),
    })
    .from(posts)
    .where(
      and(
        eq(posts.published, true),
        eq(posts.status, "published"),
        or(eq(posts.target, "feed"), eq(posts.target, "both")),
      ),
    )
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
    category?: ClubTabId;
    clubTag?: string;
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
  if (options?.category) conditions.push(clubCategoryCondition(options.category));
  if (options?.clubTag) conditions.push(clubBoardTagCondition(options.clubTag));
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
    .orderBy(...(target === "club" ? clubPostListOrder : postListOrder))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    posts: await attachPostMedia(db, page),
    nextCursor: hasMore ? offset + limit : null,
  };
}
