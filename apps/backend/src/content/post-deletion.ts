/** Удаляем строки публикации и связанные записи согласованно с порядком блокировок редактора. */
import { asc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { assertContentWriteActor, type ContentWriteActor } from "./content-write-actor";
import {
  posts,
  postComments,
  commentLikes,
  commentReports,
  likes,
  savedPosts,
  postMedia,
} from "../../../../packages/database/src/schema";

export type ContentTransaction = Parameters<
  Parameters<MySql2Database["transaction"]>[0]
>[0];

/** Caller owns the transaction; preserve the post-before-comments lock order. */
/** В транзакции вызывающего кода блокируем пост и комментарии по ID, отвязываем ответы и удаляем связанные реакции, жалобы, медиа и пост; объекты хранилища здесь не удаляются. */
export async function deletePostRows(
  tx: ContentTransaction,
  id: number,
): Promise<void> {
  await tx
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, id))
    .for("update");
  const comments = await tx
    .select({ id: postComments.id })
    .from(postComments)
    .where(eq(postComments.postId, id))
    .orderBy(asc(postComments.id))
    .for("update");
  const commentIds = comments.map((comment) => comment.id);
  if (commentIds.length) {
    await tx
      .update(postComments)
      .set({ parentId: null })
      .where(inArray(postComments.parentId, commentIds));
    await tx
      .delete(commentLikes)
      .where(inArray(commentLikes.commentId, commentIds));
    await tx
      .delete(commentReports)
      .where(inArray(commentReports.commentId, commentIds));
  }
  await tx.delete(likes).where(eq(likes.postId, id));
  await tx.delete(savedPosts).where(eq(savedPosts.postId, id));
  await tx.delete(postMedia).where(eq(postMedia.postId, id));
  await tx.delete(postComments).where(eq(postComments.postId, id));
  await tx.delete(posts).where(eq(posts.id, id));
}

/** Проверяем актуальное состояние публикации и удаляем её зависимости согласованно. */
/** Проверяем актуальную роль и версию сессии исполнителя перед каскадным удалением строк поста одной транзакцией. */
export async function deletePost(
  database: MySql2Database,
  id: number,
  actor?: ContentWriteActor,
): Promise<void> {
  await database.transaction(async tx => {
    await assertContentWriteActor(tx, actor);
    await deletePostRows(tx, id);
  });
}
