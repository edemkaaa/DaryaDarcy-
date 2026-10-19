import { and, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { z } from "zod";
import { posts, postMedia } from "../../../../packages/database/src/schema";
import { postListOrder } from "./post-order";
import { attachPostMedia } from "./post-media-repository";

export const adminPostsPageInput = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.number().int().min(0).max(1_000_000).nullish(),
    status: z.enum(["draft", "scheduled", "published"]).optional(),
    target: z.enum(["feed", "club", "both"]).optional(),
  })
  .strict()
  .default({ limit: 20 });

type Database = MySql2Database | null;
const strings = {
  mapFromDriverValue: (value: unknown): string[] =>
    typeof value === "string" ? JSON.parse(value) : (value as string[]),
};
// Do not transfer full bodies, photo galleries or attachments for list cards.
const card = {
  id: posts.id,
  text: sql<string>`LEFT(${posts.text},512)`.as("textPreview"),
  photos: sql<
    string[]
  >`IF(JSON_LENGTH(${posts.photos})>0,JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(${posts.photos},'$[0]'))),JSON_ARRAY())`
    .mapWith(strings)
    .as("cardPhotos"),
  tags: sql<
    string[]
  >`COALESCE(JSON_EXTRACT(${posts.tags},'$[0 to 2]'),JSON_ARRAY())`
    .mapWith(strings)
    .as("cardTags"),
  tagCount: sql<number>`JSON_LENGTH(${posts.tags})`
    .mapWith(Number)
    .as("tagCount"),
  hasVideo:
    sql<boolean>`EXISTS(SELECT 1 FROM ${postMedia} WHERE ${postMedia.postId}=${posts.id} AND ${postMedia.type}='video')`
      .mapWith(Boolean)
      .as("hasVideo"),
  published: posts.published,
  status: posts.status,
  target: posts.target,
  scheduledAt: posts.scheduledAt,
  publishedAt: posts.publishedAt,
  createdAt: posts.createdAt,
};

export async function getAdminPostsPage(
  db: Database,
  input: z.infer<typeof adminPostsPageInput>,
) {
  if (!db) throw new Error("Database not available");
  const offset = input.cursor ?? 0;
  const rows = await db
    .select(card)
    .from(posts)
    .where(
      and(
        input.status ? eq(posts.status, input.status) : undefined,
        input.target ? eq(posts.target, input.target) : undefined,
      ),
    )
    .orderBy(...postListOrder)
    .limit(input.limit + 1)
    .offset(offset);
  return {
    posts: rows.slice(0, input.limit),
    nextCursor: rows.length > input.limit ? offset + input.limit : null,
  };
}

export async function getAdminPostDetail(db: Database, id: number) {
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  const [post] = await attachPostMedia(db, rows);
  return post ?? null;
}
