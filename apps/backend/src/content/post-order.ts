/** Порядок выдачи публикаций задаётся до пагинации; ручной порядок админки и хронология не смешиваются неявно. */
import { asc, desc, sql } from "drizzle-orm";
import { posts } from "../../../../packages/database/src/schema";

// Shared by public catalog reads and admin date-only reads; keep one definition.
export const postDateOrder = desc(
  sql`CAST(COALESCE(${posts.publishedAt}, ${posts.createdAt}) AS DATETIME)`,
);
// LIMIT/OFFSET pages need a total order even when imported posts share dates.
export const postListOrder = [
  asc(posts.sortOrder),
  postDateOrder,
  asc(posts.id),
] as const;

// Club pages are chronological; imported timestamp ranks remain admin metadata.
export const clubPostListOrder = [postDateOrder, asc(posts.id)] as const;
