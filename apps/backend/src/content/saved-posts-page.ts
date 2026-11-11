/** Постраничное Сохранённое учитывает владельца, доступ к постам и контекст курсора. */
import { and, desc, eq, gt, lt, ne, notExists, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { z } from "zod";
import {
  posts,
  savedPosts,
  type User,
} from "../../../../packages/database/src/schema";
import { getActiveClubSubscription } from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { getPostsByIds } from "./post-catalog-repository";
import { requireContentDatabase } from "./read-database";
import {
  listPageFields,
  listPageScope,
  readListCursor,
  writeListCursor,
} from "./list-page";

export const savedPostsPageInput = z
  .object({
    ...listPageFields,
    target: z.enum(["feed", "club"]),
  })
  .strict();

/** Читаем личные сохранения по дате/id с курсором аккаунта и раздела; фильтруем опубликованность и клубный доступ до LIMIT, подавляем исторические дубли и гидратируем выбранные карточки в том же контексте. */
export async function savedPostsPage(
  database: MySql2Database | null,
  actor: User,
  input: z.infer<typeof savedPostsPageInput>,
) {
  requireContentDatabase(database);
  const scope = listPageScope("savedPostsPage", actor.id, input.target);
  const cursor = readListCursor(input.cursor, scope);
  return database.transaction(async (tx) => {
    const hasClub = await userHasClubAccess(actor, (id) =>
      getActiveClubSubscription(id, tx),
    );
    const newer = alias(savedPosts, "newer_save");
    const rows = await tx
      .select({
        id: savedPosts.id,
        at: savedPosts.createdAt,
        postId: savedPosts.postId,
      })
      .from(savedPosts)
      .innerJoin(posts, eq(posts.id, savedPosts.postId))
      .where(
        and(
          eq(savedPosts.userId, actor.id),
          eq(posts.published, true),
          eq(posts.status, "published"),
          or(eq(posts.target, input.target), eq(posts.target, "both")),
          hasClub ? undefined : ne(posts.target, "club"),
// Если старые данные содержат несколько сохранений одного поста, в выдаче участвует только последнее по дате и ID.
          notExists(
            tx
              .select({ id: newer.id })
              .from(newer)
              .where(
                and(
                  eq(newer.userId, actor.id),
                  eq(newer.postId, savedPosts.postId),
                  or(
                    gt(newer.createdAt, savedPosts.createdAt),
                    and(
                      eq(newer.createdAt, savedPosts.createdAt),
                      gt(newer.id, savedPosts.id),
                    ),
                  ),
                ),
              ),
          ),
          cursor
            ? or(
                lt(savedPosts.createdAt, cursor.at),
                and(
                  eq(savedPosts.createdAt, cursor.at),
                  lt(savedPosts.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(savedPosts.createdAt), desc(savedPosts.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit),
      last = page.at(-1);
    return {
      items: await getPostsByIds(
        tx,
        page.map((row) => row.postId),
      ),
      nextCursor:
        rows.length > input.limit && last
          ? writeListCursor(scope, last.at, last.id)
          : null,
    };
  });
}
