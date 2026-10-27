import { Injectable } from "@nestjs/common";
import { articleCreationIntent } from "./article-creation-request";
import type { InsertPost } from "../../../../packages/database/src/schema";
import {
  normalizeRichTextForStorage,
  sanitizePlainPostText,
} from "../../../../packages/shared/src/post-text-sanitize";
import * as db from "../db";
import { sendMarketingPostNotification } from "../push";
import { postCreationIntent } from "./post-creation-request";
import type { CreatePostInput, UpdatePostInput } from "./post-write-input";
import type { ImportVideosInput } from "./video-import-input";
import { userHasClubAccess } from "../identity/club-access";
import type { ReactionAccessCheck } from "./post-reactions";
import { TRPCError } from "@trpc/server";
import type { PrivateAttachmentActor } from "./private-attachment-uploads";

/** The adapter authorizes/validates inputs; existing helpers own transactions. */
@Injectable()
export class ContentWriteService {
  private readonly reactionAccess: ReactionAccessCheck = (actor, reader) =>
    userHasClubAccess(actor, (id) => db.getActiveClubSubscription(id, reader));

  toggleLike(userId: number, postId: number): Promise<boolean> {
    return db.toggleLike(userId, postId, this.reactionAccess);
  }

  toggleSave(userId: number, postId: number): Promise<boolean> {
    return db.toggleSave(userId, postId, this.reactionAccess);
  }

  createArticle(
    input: Parameters<typeof db.createArticle>[0] & { idempotencyKey?: string },
    actorUserId: number,
    actor?: PrivateAttachmentActor,
  ): Promise<number> {
    const { idempotencyKey, ...data } = input;
    return db.createArticle(
      data,
      idempotencyKey === undefined
        ? undefined
        : articleCreationIntent(actorUserId, idempotencyKey, data),
      actor,
    );
  }

  articleCreationStatus(actorUserId: number, key: string) {
    return db.getArticleCreationStatus(actorUserId, key);
  }

  async updateArticle(
    input: { id: number } & Parameters<typeof db.updateArticle>[1],
    actor?: PrivateAttachmentActor,
  ): Promise<{ ok: true }> {
    const { id, ...data } = input;
    await db.updateArticle(id, data, actor);
    return { ok: true };
  }

  async deleteArticle(id: number, actor?: PrivateAttachmentActor): Promise<{ ok: true }> {
    await db.deleteArticle(id, actor);
    return { ok: true };
  }

  deletePost(id: number, actor?: PrivateAttachmentActor): Promise<void> {
    return db.deletePost(id, actor);
  }

  deleteMedia(id: number, actor?: PrivateAttachmentActor): Promise<void> {
    return db.deletePostMediaById(id, actor);
  }

  async cleanupMediaNames(): Promise<{ ok: true }> {
    await db.clearRawCameraFilenames();
    return { ok: true };
  }

  async importVideos(input: ImportVideosInput): Promise<{ imported: number }> {
    const items = input.videos.map((video, index) => ({
      youtubeId: video.youtubeId,
      title: video.title,
      duration: video.duration ?? null,
      thumbnailUrl: video.thumbnailUrl ?? null,
      videoUrl: null,
      views: video.views ?? null,
      publishedText: video.publishedText ?? null,
      sortOrder: index,
      published: true,
    }));
    const count = await db.bulkImportVideos(items);
    return { imported: count };
  }

  async createPost(
    actorUserId: number,
    input: CreatePostInput,
    actor?: PrivateAttachmentActor,
  ): Promise<number> {
    const { idempotencyKey, ...payload } = input;
    const {
      scheduledAt,
      publishedAt,
      published,
      status,
      videos = [],
      attachments,
      privateAssetIds,
      privateVideoPosters,
      ...rest
    } = payload;
    if (privateAssetIds?.length && !idempotencyKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Для закрытых вложений нужен ключ создания поста" });
    const text = sanitizePlainPostText(rest.text);
    const richText = normalizeRichTextForStorage(rest.richText, text);
    const tags =
      videos.length > 0 && !rest.tags.includes("video")
        ? [...rest.tags, "video"]
        : rest.tags;
    const resolvedStatus =
      status === "scheduled"
        ? "scheduled"
        : published === false || status === "draft"
          ? "draft"
          : "published";
    const postData: InsertPost = {
      ...rest,
      text,
      richText,
      tags,
      status: resolvedStatus,
      published: resolvedStatus === "published",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      publishedAt:
        resolvedStatus === "published"
          ? publishedAt
            ? new Date(publishedAt)
            : new Date()
          : resolvedStatus === "draft" && publishedAt
            ? new Date(publishedAt)
            : null,
    };
    // Hash the validated intent, not generated dates or normalized storage data.
    const result = idempotencyKey
      ? await db.createPostOnce(
          postData,
          videos,
          {
            attachments,
            actor,
            ...(privateVideoPosters?.length ? { privateVideoPosters } : {}),
            ...(privateAssetIds?.length ? { privateAssetIds } : {}),
          },
          postCreationIntent(actorUserId, idempotencyKey, payload),
        )
      : {
          postId: await db.createPostWithVideos(postData, videos, {
            attachments,
            actor,
            ...(privateVideoPosters?.length ? { privateVideoPosters } : {}),
            ...(privateAssetIds?.length ? { privateAssetIds } : {}),
          }),
          created: true,
        };
    if (result.created && resolvedStatus === "published") {
      void sendMarketingPostNotification(text, result.postId, rest.target);
    }
    return result.postId;
  }

  async updatePost(input: UpdatePostInput, actor?: PrivateAttachmentActor): Promise<{ success: boolean }> {
    const {
      id,
      scheduledAt,
      publishedAt,
      videos,
      attachments,
      privateAssetIds,
      privateVideoPosters,
      removedMediaIds,
      ...data
    } = input;
    const updateData: Partial<InsertPost> = { ...data };
    if (typeof data.text === "string") {
      updateData.text = sanitizePlainPostText(data.text);
    }
    if (data.richText !== undefined) {
      const plain =
        typeof updateData.text === "string"
          ? updateData.text
          : typeof data.text === "string"
            ? sanitizePlainPostText(data.text)
            : "";
      updateData.richText = normalizeRichTextForStorage(data.richText, plain);
    }
    // Plain edits must not keep stale formatted blocks rendering the old text.
    if (data.text !== undefined && data.richText === undefined) {
      updateData.richText = null;
    }
    if (
      videos !== undefined &&
      videos.length > 0 &&
      Array.isArray(data.tags) &&
      !data.tags.includes("video")
    ) {
      updateData.tags = [...data.tags, "video"];
    }
    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    }
    if (publishedAt !== undefined) {
      updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
    }
    const publication = await db.savePostEdit(id, updateData, videos, {
      attachments,
      removedMediaIds,
      ...(privateVideoPosters?.length ? { privateVideoPosters } : {}),
      actor,
      ...(privateAssetIds?.length ? { privateAssetIds } : {}),
    });
    if (publication) {
      void sendMarketingPostNotification(
        publication.text,
        publication.id,
        publication.target,
      );
    }
    return { success: true };
  }

  async confirmPost(postId: number, actor?: PrivateAttachmentActor): Promise<{ success: boolean }> {
    const post = await db.confirmScheduledPost(postId, actor);
    if (post) {
      void sendMarketingPostNotification(post.text, post.id, post.target);
    }
    return { success: true };
  }
}
