import { Injectable } from "@nestjs/common";
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
    input: Parameters<typeof db.createArticle>[0],
  ): Promise<number> {
    return db.createArticle(input);
  }

  async updateArticle(
    input: { id: number } & Parameters<typeof db.updateArticle>[1],
  ): Promise<{ ok: true }> {
    const { id, ...data } = input;
    await db.updateArticle(id, data);
    return { ok: true };
  }

  async deleteArticle(id: number): Promise<{ ok: true }> {
    await db.deleteArticle(id);
    return { ok: true };
  }

  deletePost(id: number): Promise<void> {
    return db.deletePost(id);
  }

  deleteMedia(id: number): Promise<void> {
    return db.deletePostMediaById(id);
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
  ): Promise<number> {
    const { idempotencyKey, ...payload } = input;
    const {
      scheduledAt,
      publishedAt,
      published,
      status,
      videos = [],
      attachments,
      ...rest
    } = payload;
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
          { attachments },
          postCreationIntent(actorUserId, idempotencyKey, payload),
        )
      : {
          postId: await db.createPostWithVideos(postData, videos, {
            attachments,
          }),
          created: true,
        };
    if (result.created && resolvedStatus === "published") {
      void sendMarketingPostNotification(text, result.postId, rest.target);
    }
    return result.postId;
  }

  async updatePost(input: UpdatePostInput): Promise<{ success: boolean }> {
    const {
      id,
      scheduledAt,
      publishedAt,
      videos,
      attachments,
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

  async confirmPost(postId: number): Promise<{ success: boolean }> {
    const post = await db.confirmScheduledPost(postId);
    if (post) {
      void sendMarketingPostNotification(post.text, post.id, post.target);
    }
    return { success: true };
  }
}
