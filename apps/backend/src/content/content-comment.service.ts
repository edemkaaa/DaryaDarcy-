/** Сервис обсуждений объединяет проверку доступа к посту и операции с комментариями. */
import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { User } from "../../../../packages/database/src/schema";
import { areCommentsOpen } from "../../../../packages/shared/src/club-tags";
import * as db from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { sendServicePushNotification } from "../push";
import type { AddCommentInput } from "./comment-input";
import * as comments from "./comments";
import { hasPrivateContent } from "./private-content-binding";
import { commentsPage, type commentsPageInput } from "./comments-page";
import type { z } from "zod";

/** Transport owns validation/authentication; SQL helpers retain transaction locks. */
@Injectable()
export class ContentCommentService {
  /** Предварительно требует существующий published/status=published parent, не подменяя отсутствие ошибкой доступа. */
  private async publishedPost(postId: number) {
    const post = await db.getPostById(postId);
    if (!post || !post.published || post.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден" });
    }
    return post;
  }

  /** Находит comment и published parent и предварительно проверяет club-доступ текущего user; writer затем повторяет проверку под блокировками. */
  private async requireReadableComment(id: number, user: User) {
    const comment = await comments.getPostCommentById(id);
    const post = comment ? await db.getPostById(comment.postId) : undefined;
    if (!comment || !post || !post.published || post.status !== "published") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Комментарий не найден",
      });
    }
    if (post.target === "club" && !(await userHasClubAccess(user))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Доступно только участницам клуба Darcy",
      });
    }
  }

  /** Требует доступный published parent и передаёт viewerId в совместимое capped чтение обсуждения. */
  async list(postId: number, user: User) {
    const post = await this.publishedPost(postId);
    if (post.target === "club" && !(await userHasClubAccess(user))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Доступно только участницам клуба Darcy",
      });
    }
    return comments.listPostCommentsV2(postId, user.id);
  }

  /** Передаёт user и validated cursor/post/parent в общую snapshot-пагинацию комментариев. */
  async listPage(input: z.infer<typeof commentsPageInput>, user: User) {
    return commentsPage(await db.getDb(), user, input);
  }

  /** Проверяет published/club/open-window, сохраняет comment через общий recovery writer и отправляет reply push лишь для новой записи после коммита. */
  async add(user: User, input: AddCommentInput): Promise<{ id: number }> {
    const post = await this.publishedPost(input.postId);
    if (post.target === "club" && !(await userHasClubAccess(user))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Доступно только участницам клуба Darcy",
      });
    }
    if (
      !areCommentsOpen(
        post.tags as string[],
        post.publishedAt ?? post.createdAt,
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Комментарии к этому посту закрыты",
      });
    }
    const data = {
      postId: input.postId,
      userId: user.id,
      text: input.text,
      parentId: input.parentId,
      photos: input.photos,
      actor: user,
      idempotencyKey: input.idempotencyKey,
    };
    const result = input.idempotencyKey !== undefined || hasPrivateContent((input.photos ?? []).map(url => ({ url, usage: "commentPhoto" })))
      ? await comments.addPostCommentWithResult(data)
      : { id: await comments.addPostCommentV2(data), created: true };
    const id = result.id;
    // Dispatch only after the comment transaction commits; durable delivery is separate.
    if (input.parentId && result.created) {
      const parent = await comments.getPostCommentById(input.parentId);
      if (parent && parent.userId !== user.id) {
        const preview =
          input.text.length > 80 ? `${input.text.slice(0, 80)}…` : input.text;
        const author = (user.name || "Участница").trim();
        void sendServicePushNotification({
          userId: parent.userId,
          title: "Ответ на ваш комментарий",
          body: `${author}: ${preview}`,
          data: {
            postId: input.postId,
            type: "comment_reply",
            commentId: input.parentId,
          },
          target: "club",
        });
      }
    }
    return { id };
  }

  /** Проверяет читаемость обсуждения и делегирует обновление авторскому writer с current actor. */
  async update(user: User, id: number, text: string): Promise<{ ok: true }> {
    await this.requireReadableComment(id, user);
    await comments.updatePostCommentV2(id, user, text);
    return { ok: true };
  }

  /** После проверки доступности передаёт текущего actor транзакционному toggle; слепой сетевой повтор изменит состояние снова. */
  async toggleLike(user: User, commentId: number) {
    await this.requireReadableComment(commentId, user);
    return comments.toggleCommentLike(user, commentId);
  }

  /** После readable-проверки удаляет комментарий через writer, который повторно проверяет авторство/служебную роль. */
  async delete(user: User, id: number): Promise<{ ok: true }> {
    await this.requireReadableComment(id, user);
    await comments.deletePostCommentV2(id, user);
    return { ok: true };
  }

  /** Проверяет доступ к обсуждению и записывает ограниченную уникальную жалобу от текущего пользователя. */
  async report(user: User, id: number, reason: string): Promise<{ ok: true }> {
    await this.requireReadableComment(id, user);
    await comments.reportComment(id, user, reason);
    return { ok: true };
  }
}
