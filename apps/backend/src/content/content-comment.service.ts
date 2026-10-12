import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { User } from "../../../../packages/database/src/schema";
import { areCommentsOpen } from "../../../../packages/shared/src/club-tags";
import * as db from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { isStaffAccount } from "../platform-db";
import { sendServicePushNotification } from "../push";
import type { AddCommentInput } from "./comment-input";
import * as comments from "./comments";

/** Transport owns validation/authentication; SQL helpers retain transaction locks. */
@Injectable()
export class ContentCommentService {
  private async publishedPost(postId: number) {
    const post = await db.getPostById(postId);
    if (!post || !post.published || post.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден" });
    }
    return post;
  }

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
    const id = await comments.addPostCommentV2({
      postId: input.postId,
      userId: user.id,
      text: input.text,
      parentId: input.parentId,
      photos: input.photos,
    });
    // Dispatch only after the comment transaction commits; durable delivery is separate.
    if (input.parentId) {
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

  async update(user: User, id: number, text: string): Promise<{ ok: true }> {
    await this.requireReadableComment(id, user);
    await comments.updatePostCommentV2(id, user.id, text);
    return { ok: true };
  }

  async toggleLike(user: User, commentId: number) {
    await this.requireReadableComment(commentId, user);
    return comments.toggleCommentLike(user.id, commentId);
  }

  async delete(user: User, id: number): Promise<{ ok: true }> {
    await this.requireReadableComment(id, user);
    await comments.deletePostCommentV2(id, user.id, isStaffAccount(user));
    return { ok: true };
  }

  async report(user: User, id: number, reason: string): Promise<{ ok: true }> {
    await this.requireReadableComment(id, user);
    await comments.reportComment(id, user.id, reason);
    return { ok: true };
  }
}
