import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { z } from "zod";
import {
  likes,
  savedPosts,
  posts,
  type User,
} from "../../../../packages/database/src/schema";
import { getActiveClubSubscription } from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { requireContentDatabase } from "./read-database";

export const postInteractionsInput = z
  .object({ postIds: z.array(z.number().int().positive().safe()).max(50) })
  .strict();

export async function postInteractionsForIds(
  database: MySql2Database | null,
  actor: User,
  requested: number[],
) {
  const ids = [...new Set(requested)];
  if (!ids.length)
    return { likedIds: [] as number[], savedIds: [] as number[] };
  requireContentDatabase(database);
  return database.transaction(async (tx) => {
    const hasClub = await userHasClubAccess(actor, (id) =>
      getActiveClubSubscription(id, tx),
    );
    const visible = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          inArray(posts.id, ids),
          eq(posts.published, true),
          eq(posts.status, "published"),
          hasClub ? undefined : ne(posts.target, "club"),
        ),
      )
      .limit(ids.length);
    if (!visible.length)
      return { likedIds: [] as number[], savedIds: [] as number[] };
    const readable = visible.map((row) => row.id);
    async function marks(table: typeof likes | typeof savedPosts) {
      const rows = await tx
        .selectDistinct({ postId: table.postId })
        .from(table)
        .where(and(eq(table.userId, actor.id), inArray(table.postId, readable)))
        .orderBy(asc(table.postId))
        .limit(readable.length);
      return rows.map((row) => row.postId);
    }
    return { likedIds: await marks(likes), savedIds: await marks(savedPosts) };
  });
}
