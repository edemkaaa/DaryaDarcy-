import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  likes,
  savedPosts,
  users,
} from "../../../../packages/database/src/schema";

export async function getUserLikedPostIds(
  db: MySql2Database | null,
  userId: number,
): Promise<number[]> {
  if (!db) return [];

  const result = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(eq(likes.userId, userId));
  return result.map((r) => r.postId);
}

export async function getUserSavedPostIds(
  db: MySql2Database | null,
  userId: number,
): Promise<number[]> {
  if (!db) return [];

  const result = await db
    .select({ postId: savedPosts.postId })
    .from(savedPosts)
    .where(eq(savedPosts.userId, userId))
    .orderBy(desc(savedPosts.createdAt));
  return result.map((r) => r.postId);
}

/** Toggle once per committed request; a network retry is still a new toggle. */
export async function togglePostReaction(
  database: MySql2Database,
  kind: "like" | "save",
  userId: number,
  postId: number,
): Promise<boolean> {
  const table = kind === "like" ? likes : savedPosts;
  return database.transaction(async (tx) => {
    // A stable actor row serializes requests even when no reaction row exists.
    // Read the reaction only after acquiring it, so no stale snapshot wins.
    const [actor] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!actor) throw new Error("Reaction actor no longer exists");
    const pair = and(eq(table.userId, userId), eq(table.postId, postId));
    const existing = await tx
      .select({ id: table.id })
      .from(table)
      .where(pair)
      .limit(1);
    if (existing.length) {
      // Preserve disable semantics for databases with historical duplicate rows.
      await tx.delete(table).where(pair);
      return false;
    }
    await tx.insert(table).values({ userId, postId });
    return true;
  });
}
