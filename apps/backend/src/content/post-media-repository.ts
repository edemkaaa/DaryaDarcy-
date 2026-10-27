import { asc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  postMedia,
  type PostMedia,
} from "../../../../packages/database/src/schema";

// Reuse one batched hydration path for feed, detail, bookmarks and admin lists.
// Connection ownership and visibility decisions remain with the callers.
export async function attachPostMedia<T extends { id: number }>(
  db: Pick<MySql2Database, "select">,
  page: T[],
): Promise<(T & { media: PostMedia[] })[]> {
  if (page.length === 0) return [];
  try {
    const mediaRows = await db
      .select()
      .from(postMedia)
      .where(
        inArray(
          postMedia.postId,
          page.map((p) => p.id),
        ),
      )
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
    throw error;
  }
}

export async function getPostMediaByPostId(
  db: MySql2Database | null,
  postId: number,
): Promise<PostMedia[]> {
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(postMedia)
    .where(eq(postMedia.postId, postId))
    .orderBy(asc(postMedia.sortOrder));
}
