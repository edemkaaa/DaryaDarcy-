import { eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { posts, type Post } from "../../../../packages/database/src/schema";

export type PostPublication = Pick<Post, "id" | "text" | "target">;

/** Return an announcement only for this call's committed visibility transition. */
export async function confirmPostPublication(
  database: MySql2Database,
  postId: number,
): Promise<PostPublication | undefined> {
  return database.transaction(async (tx) => {
    const [post] = await tx
      .select({
        id: posts.id,
        text: posts.text,
        target: posts.target,
        status: posts.status,
        published: posts.published,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (!post || (post.status === "published" && post.published))
      return undefined;

    await tx
      .update(posts)
      .set({
        status: "published",
        published: true,
        // Manual confirmation means now, even before the scheduled date.
        publishedAt: sql`COALESCE(${posts.publishedAt}, UTC_TIMESTAMP())`,
      })
      .where(eq(posts.id, postId));

    return { id: post.id, text: post.text, target: post.target };
  });
}
