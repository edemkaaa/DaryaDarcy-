import { and, asc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { posts } from "../../../../packages/database/src/schema";
import type { PostPublication } from "./publication";

/** Return only the rows claimed and committed by this scheduler invocation. */
export async function publishDueScheduledPosts(
  db: MySql2Database | null,
): Promise<PostPublication[]> {
  if (!db) return [];

  return db.transaction(async (tx) => {
    // Claim the current rows before changing them. Another scheduler/admin
    // holding a row leaves it for a later tick, never a stale announcement.
    const due = await tx
      .select({ id: posts.id, text: posts.text, target: posts.target })
      .from(posts)
      .where(and(
        eq(posts.status, "scheduled"),
        isNotNull(posts.scheduledAt),
        lte(posts.scheduledAt, new Date()),
      ))
      .orderBy(asc(posts.id))
      .for("update", { skipLocked: true });

    if (due.length === 0) return [];

    await tx.update(posts).set({
      status: "published",
      published: true,
      publishedAt: sql`COALESCE(${posts.publishedAt}, ${posts.scheduledAt}, UTC_TIMESTAMP())`,
    }).where(inArray(posts.id, due.map((post) => post.id)));

    // The transaction resolves only after commit; callers announce this batch.
    return due;
  });
}
