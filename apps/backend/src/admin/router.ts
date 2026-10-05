import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { storagePut } from "../storage";
import { photoInput, uploadPhoto } from "../media/photos";
import { importVideoFromUrl } from "../admin-video";
import type { ContentWriteService } from "../content/content-write.service";
import { createPostInput, updatePostInput } from "../content/post-write-input";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";

export const createAdminRouter = (posts: ContentWriteService) => router({
  // Get all posts including unpublished (admin only)
  posts: adminProcedure.query(() => {
    return db.getAllPostsAdmin();
  }),

  // Create a new post (admin only)
  createPost: adminProcedure
    .input(createPostInput)
    .mutation(({ input, ctx }) => posts.createPost(ctx.user.id, input)),

  // Update an existing post (admin only)
  updatePost: adminProcedure
    .input(updatePostInput)
    .mutation(({ input }) => posts.updatePost(input)),

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
    .mutation(({ input }) => posts.confirmPost(input.id)),

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
