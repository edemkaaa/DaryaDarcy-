/** Постраничное чтение обсуждения с проверкой доступа к публикации и привязкой курсора к списку. */
import { and, asc, count, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  postComments,
  posts,
  users,
  type User,
} from "../../../../packages/database/src/schema";
import { getActiveClubSubscription } from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { commentLikeCounts, viewerLikedCommentIds } from "./comments";
import {
  listPageFields,
  listPageScope,
  readListCursor,
  writeListCursor,
} from "./list-page";
import { requireContentDatabase } from "./read-database";

export const commentsPageInput = z
  .object({
    ...listPageFields,
    postId: z.number().int().positive().safe(),
    parentId: z.number().int().positive().safe().nullish(),
  })
  .strict();

/** Ограничиваем страницу и проверяем контекст курсора перед возвратом обсуждения. */
export async function commentsPage(
  database: MySql2Database | null,
  actor: User,
  input: z.infer<typeof commentsPageInput>,
) {
  requireContentDatabase(database);
  const scope = listPageScope(
    "commentsPage",
    actor.id,
    input.postId,
    input.parentId ?? null,
  );
  const cursor = readListCursor(input.cursor, scope);
  return database.transaction(async (tx) => {
    // One consistent read view: publication/access, group, counts and hydration.
    const [post] = await tx
      .select({
        target: posts.target,
        published: posts.published,
        status: posts.status,
      })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1);
    if (!post?.published || post.status !== "published")
      throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден" });
    if (
      post.target === "club" &&
      !(await userHasClubAccess(actor, (id) =>
        getActiveClubSubscription(id, tx),
      ))
    )
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Доступно только участницам клуба Darcy",
      });
    if (input.parentId != null) {
      const [parent] = await tx
        .select({ id: postComments.id })
        .from(postComments)
        .where(
          and(
            eq(postComments.id, input.parentId),
            eq(postComments.postId, input.postId),
          ),
        )
        .limit(1);
      if (!parent)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Комментарий не найден",
        });
    }
    const rows = await tx
      .select({
        comment: postComments,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(postComments)
      .leftJoin(users, eq(users.id, postComments.userId))
      .where(
        and(
          eq(postComments.postId, input.postId),
          input.parentId == null
            ? isNull(postComments.parentId)
            : eq(postComments.parentId, input.parentId),
          cursor
            ? or(
                gt(postComments.createdAt, cursor.at),
                and(
                  eq(postComments.createdAt, cursor.at),
                  gt(postComments.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(postComments.createdAt), asc(postComments.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit),
      ids = page.map((row) => row.comment.id),
      last = page.at(-1)?.comment;
    const counts = ids.length
      ? await tx
          .select({ parentId: postComments.parentId, count: count() })
          .from(postComments)
          .where(
            and(
              eq(postComments.postId, input.postId),
              inArray(postComments.parentId, ids),
            ),
          )
          .groupBy(postComments.parentId)
      : [];
    const replyCounts = new Map(counts.map((row) => [row.parentId, row.count]));
    const likeCounts = await commentLikeCounts(tx, ids),
      liked = await viewerLikedCommentIds(tx, actor.id, ids);
    const [total] = await tx
      .select({ count: count() })
      .from(postComments)
      .where(eq(postComments.postId, input.postId));
    return {
      items: page.map((row) => ({
        ...row.comment,
        authorName: row.authorName ?? null,
        authorAvatarUrl: row.authorAvatarUrl ?? null,
        likeCount: likeCounts.get(row.comment.id) ?? 0,
        likedByMe: liked.has(row.comment.id),
        replyCount: replyCounts.get(row.comment.id) ?? 0,
      })),
      totalCount: total.count,
      nextCursor:
        rows.length > input.limit && last
          ? writeListCursor(scope, last.createdAt, last.id)
          : null,
    };
  });
}
