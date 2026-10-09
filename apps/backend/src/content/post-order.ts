import { asc, desc, sql } from "drizzle-orm";
import { posts } from "../../../../packages/database/src/schema";

// Shared by public catalog reads and admin date-only reads; keep one definition.
export const postDateOrder = desc(
  sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`,
);
export const postListOrder = [asc(posts.sortOrder), postDateOrder] as const;
