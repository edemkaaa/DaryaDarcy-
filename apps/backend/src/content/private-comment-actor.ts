/** Проверяем актуальную сессию и доступ к обсуждению перед операциями с закрытым фото комментария. */
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { posts, type User } from "../../../../packages/database/src/schema";
import { areCommentsOpen } from "../../../../packages/shared/src/club-tags";
import { readActiveClubSubscription } from "../billing/subscription-reader";
import { hasClubAccess } from "../identity/club-access-policy";
import type { ContentTransaction } from "./post-deletion";
import { lockCurrentContentActor, type ContentWriteActor } from "./content-write-actor";

/** Existing member/comment permissions, rechecked in the writer's transaction. */
/** Блокируем текущего пользователя и сверяем сессию; запрос удаления аккаунта запрещает новую операцию с фото комментария. */
export async function lockCommentFileActor(tx: ContentTransaction, actor: ContentWriteActor) {
  const current = await lockCurrentContentActor(tx, actor);
  if (current.accountDeletionRequestedAt) throw new TRPCError({ code: "FORBIDDEN" });
  return current;
}
/** В транзакции записи повторно проверяем пользователя, публикацию и срок открытых комментариев перед загрузкой или привязкой фото. */
export async function requireCommentFilePost(tx: ContentTransaction, actor: ContentWriteActor, postId: number) {
  const current = await lockCommentFileActor(tx, actor);
  const post = await requireReadableCommentPost(tx, current, postId);
  if (!areCommentsOpen(post.tags, post.publishedAt ?? post.createdAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "Комментарии к этому посту закрыты" });
}

/** Keep the post locked until the comment mutation commits. */
/** Удерживаем разделяемую блокировку опубликованного поста и активной подписки до коммита комментария, чтобы доступ не опирался на устаревшую видимость. */
export async function requireReadableCommentPost(tx: ContentTransaction, current: User, postId: number) {
  const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for("share");
  if (!post?.published || post.status !== "published") throw new TRPCError({ code: "NOT_FOUND" });
  if (post.target === "club" && !(await hasClubAccess(current, id => readActiveClubSubscription(tx, id, "share")))) throw new TRPCError({ code: "FORBIDDEN" });
  return post;
}
