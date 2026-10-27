import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  likes,
  savedPosts,
  users,
  posts,
  type User,
} from "../../../../packages/database/src/schema";
import { TRPCError } from "@trpc/server";
import { boundedLegacyList, LEGACY_LIST_CAP } from "./legacy-list-limit";

export type ReactionAccessCheck = (
  actor: Pick<User, "id" | "role" | "email" | "openId" | "blockedAt">,
  reader: Pick<MySql2Database, "select">,
) => Promise<boolean>;

export async function getUserLikedPostIds(
  db: MySql2Database | null,
  userId: number,
): Promise<number[]> {
  if (!db) return [];

  const result = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(eq(likes.userId, userId)).limit(LEGACY_LIST_CAP + 1);
  return boundedLegacyList(result).map((r) => r.postId);
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
    .orderBy(desc(savedPosts.createdAt)).limit(LEGACY_LIST_CAP + 1);
  return boundedLegacyList(result).map((r) => r.postId);
}

/** Toggle once per committed request; a network retry is still a new toggle. */
export async function togglePostReaction(
  database: MySql2Database,
  kind: "like" | "save",
  userId: number,
  postId: number,
  hasClubAccess: ReactionAccessCheck,
): Promise<boolean> {
  const table = kind === "like" ? likes : savedPosts;
  return database.transaction(async (tx) => {
    // A stable actor row serializes requests even when no reaction row exists.
    // Read the reaction only after acquiring it, so no stale snapshot wins.
    const [actor] = await tx
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        openId: users.openId,
        blockedAt: users.blockedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!actor) throw new Error("Reaction actor no longer exists");
    if (actor.blockedAt)
      throw new TRPCError({ code: "FORBIDDEN", message: "Доступ ограничен" });
    // A current locked read fences deletion and visibility edits until commit.
    const [post] = await tx
      .select({
        id: posts.id,
        published: posts.published,
        status: posts.status,
        target: posts.target,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (!post || !post.published || post.status !== "published")
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
    if (post.target === "club" && !(await hasClubAccess(actor, tx)))
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Материал доступен участницам клуба",
      });
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
