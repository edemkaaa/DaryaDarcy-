import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import type { InsertPost } from "../../../../packages/database/src/schema";
import * as db from "../db";
import { storagePut } from "../storage";
import { photoInput, uploadPhoto } from "../media/photos";
import { importVideoFromUrl } from "../admin-video";
import { sendMarketingPostNotification as sendNewPostNotification } from "../push";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";
import {
  normalizeRichTextForStorage,
  sanitizePlainPostText,
} from "../../../../packages/shared/src/post-text-sanitize";

export const adminRouter = router({
  // Get all posts including unpublished (admin only)
  posts: adminProcedure.query(() => {
    return db.getAllPostsAdmin();
  }),

  // Create a new post (admin only)
  createPost: adminProcedure
    .input(
      z.object({
        text: z.string().min(1),
        photos: z.array(z.string()),
        tags: z.array(z.string()),
        videos: z.array(z.string()).optional(),
        source: z.string().default("manual"),
        published: z.boolean().default(true),
        sortOrder: z.number().default(0),
        status: z
          .enum(["draft", "scheduled", "published"])
          .default("published"),
        target: z.enum(["feed", "club", "both"]).default("feed"),
        scheduledAt: z.string().nullable().optional(), // ISO date string
        publishedAt: z.string().nullable().optional(),
        richText: z.any().optional(), // JSON rich text blocks
      }),
    )
    .mutation(async ({ input }) => {
      const {
        scheduledAt,
        publishedAt,
        published,
        status,
        videos = [],
        ...rest
      } = input;
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
      const postId = await db.createPostWithVideos(postData, videos);
      if (resolvedStatus === "published") {
        void sendNewPostNotification(text, postId, rest.target);
      }
      return postId;
    }),

  // Update an existing post (admin only)
  updatePost: adminProcedure
    .input(
      z.object({
        id: z.number(),
        text: z.string().optional(),
        photos: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        videos: z.array(z.string()).optional(),
        published: z.boolean().optional(),
        sortOrder: z.number().optional(),
        status: z.enum(["draft", "scheduled", "published"]).optional(),
        target: z.enum(["feed", "club", "both"]).optional(),
        scheduledAt: z.string().nullable().optional(),
        publishedAt: z.string().nullable().optional(),
        richText: z.any().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, scheduledAt, publishedAt, videos, ...data } = input;
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
      // Editing plain text must drop stale richText, otherwise the old formatted
      // blocks keep rendering and it looks like the save did nothing.
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
      const publication = await db.savePostEdit(id, updateData, videos);
      if (publication)
        void sendNewPostNotification(
          publication.text,
          publication.id,
          publication.target,
        );
      return { success: true };
    }),

  // Delete a post (admin only)
  deletePost: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      return db.deletePost(input.id);
    }),

  importVideoUrl: adminProcedure
    .input(
      z.object({
        url: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      return importVideoFromUrl(input.url);
    }),

  // Upload photo (admin only)
  uploadPhoto: adminProcedure.input(photoInput).mutation(async ({ input }) => {
    return uploadPhoto(input.base64, "feed/photos");
  }),

  // Upload media file (video/audio/document) (admin only)
  uploadMedia: adminProcedure
    .input(
      z.object({
        base64: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        type: z.enum(["video", "audio", "document"]),
        postId: z.number().optional(),
        duration: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const folder =
        input.type === "video"
          ? "videos"
          : input.type === "audio"
            ? "audio"
            : "documents";
      const safeName = isRawMediaFilename(input.filename)
        ? `${input.type}-${Date.now()}`
        : input.filename;
      const storedName = isRawMediaFilename(input.filename)
        ? null
        : input.filename;
      const key = `feed/${folder}/${Date.now()}_${safeName}`;
      const result = await storagePut(key, buffer, input.mimeType);

      // If postId provided, create post_media record
      let mediaId: number | undefined;
      if (input.postId) {
        mediaId = await db.createPostMedia({
          postId: input.postId,
          type: input.type,
          url: result.url,
          filename: storedName,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          duration: input.duration ?? null,
          sortOrder: 0,
        });
      }

      return { url: result.url, mediaId };
    }),

  // Get media for a post (admin only)
  getPostMedia: adminProcedure
    .input(z.object({ postId: z.number() }))
    .query(({ input }) => {
      return db.getPostMediaByPostId(input.postId);
    }),

  // Delete a media attachment (admin only)
  deleteMedia: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      return db.deletePostMediaById(input.id);
    }),

  // Get scheduled posts for calendar (admin only)
  scheduledPosts: adminProcedure.query(() => {
    return db.getScheduledPosts();
  }),

  // Get post statistics for admin dashboard
  stats: adminProcedure.query(() => {
    return db.getPostStatistics();
  }),
  members: adminProcedure.query(() => {
    return db.listAdminMembers();
  }),
  payments: adminProcedure.query(() => {
    return db.listAdminPayments();
  }),
  grantClub: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const expiresAt = await db.grantClubDays(input.userId);
      return { ok: true as const, expiresAt: expiresAt.toISOString() };
    }),
  articles: adminProcedure.query(() => db.listAllArticles()),
  createArticle: adminProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(255),
        coverUrl: z.string().nullable().optional(),
        access: z.enum(["public", "club"]).default("club"),
        published: z.boolean().default(true),
        sortOrder: z.number().optional(),
        sections: z.array(
          z.object({
            type: z.enum([
              "heading",
              "text",
              "photo",
              "png",
              "link",
              "carousel",
            ]),
            text: z.string().optional().default(""),
            url: z.string().optional().default(""),
            label: z.string().optional().default(""),
            caption: z.string().optional().default(""),
            urls: z.array(z.string()).optional().default([]),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await db.createArticle({
        ...input,
        coverUrl: input.coverUrl ?? null,
        sections: input.sections,
      });
      await db.upsertArticleTeaser({
        id,
        title: input.title,
        coverUrl: input.coverUrl ?? null,
        access: input.access,
        published: input.published,
      });
      return id;
    }),
  updateArticle: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().trim().min(1).max(255).optional(),
        coverUrl: z.string().nullable().optional(),
        access: z.enum(["public", "club"]).optional(),
        published: z.boolean().optional(),
        sortOrder: z.number().optional(),
        sections: z
          .array(
            z.object({
              type: z.enum([
                "heading",
                "text",
                "photo",
                "png",
                "link",
                "carousel",
              ]),
              text: z.string().optional().default(""),
              url: z.string().optional().default(""),
              label: z.string().optional().default(""),
              caption: z.string().optional().default(""),
              urls: z.array(z.string()).optional().default([]),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateArticle(id, data);
      const article = await db.getArticleById(id);
      if (article) {
        await db.upsertArticleTeaser({
          id: article.id,
          title: article.title,
          coverUrl: article.coverUrl,
          access: article.access as "public" | "club",
          published: Boolean(article.published),
        });
      }
      return { ok: true as const };
    }),
  deleteArticle: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteArticle(input.id);
      return { ok: true as const };
    }),
  cleanupMediaNames: adminProcedure.mutation(async () => {
    await db.clearRawCameraFilenames();
    return { ok: true as const };
  }),

  // Confirm a scheduled post (publish it) (admin only)
  confirmPost: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const post = await db.confirmScheduledPost(input.id);
      if (post) {
        void sendNewPostNotification(post.text, post.id, post.target);
      }
      return { success: true };
    }),

  // Get admin posts filtered by status/target
  postsFiltered: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "scheduled", "published"]).optional(),
          target: z.enum(["feed", "club", "both"]).optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      return db.getAdminPostsFiltered(input);
    }),

  // Import YouTube videos (admin only)
  importVideos: adminProcedure
    .input(
      z.object({
        videos: z.array(
          z.object({
            youtubeId: z.string(),
            title: z.string(),
            duration: z.string().optional(),
            thumbnailUrl: z.string().optional(),
            views: z.string().optional(),
            publishedText: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const items = input.videos.map((v, i) => ({
        youtubeId: v.youtubeId,
        title: v.title,
        duration: v.duration ?? null,
        thumbnailUrl: v.thumbnailUrl ?? null,
        videoUrl: null,
        views: v.views ?? null,
        publishedText: v.publishedText ?? null,
        sortOrder: i,
        published: true,
      }));
      const count = await db.bulkImportVideos(items);
      return { imported: count };
    }),

  /** Remove push tokens when deleting/deactivating a user account (manual deletion workflow). */
  purgeUserPushData: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePushTokensForUser(input.userId);
      return { success: true };
    }),
});
