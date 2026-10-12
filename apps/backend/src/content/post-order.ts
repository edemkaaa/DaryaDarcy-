import { asc, desc, sql } from "drizzle-orm";
import { posts } from "../../../../packages/database/src/schema";

// Shared by public catalog reads and admin date-only reads; keep one definition.
export const postDateOrder = desc(
  sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`,
);
// LIMIT/OFFSET pages need a total order even when imported posts share dates.
export const postListOrder = [
  asc(posts.sortOrder),
  postDateOrder,
  asc(posts.id),
] as const;
