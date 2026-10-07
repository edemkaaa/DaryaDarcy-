import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { photoInput } from "../media/photos";
import type { ContentWriteService } from "../content/content-write.service";
import { createPostInput, updatePostInput } from "../content/post-write-input";
import type { ContentUploadService } from "../content/content-upload.service";
import { mediaUploadInput } from "../content/media-upload-input";
import type { ContentReadService } from "../content/content-read.service";
import { importVideosInput } from "../content/video-import-input";
import type { NotificationsService } from "../notifications/notifications.service";

export const createAdminRouter = (
  content: ContentReadService,
  posts: ContentWriteService,
  uploads: ContentUploadService,
  notifications: NotificationsService,
) => router({
  // Get all posts including unpublished (admin only)
  posts: adminProcedure.query(() => content.listAllAdminPosts()),

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
    .mutation(({ input }) => posts.deletePost(input.id)),

  importVideoUrl: adminProcedure
    .input(
      z.object({
        url: z.string().min(8),
      }),
    )
    .mutation(({ input }) => uploads.importVideoFromUrl(input.url)),

  // Upload photo (admin only)
  uploadPhoto: adminProcedure.input(photoInput).mutation(({ input }) => uploads.uploadPhoto(input.base64)),

  // Upload media file (video/audio/document) (admin only)
  uploadMedia: adminProcedure
    .input(mediaUploadInput)
    .mutation(({ input }) => uploads.uploadMedia(input)),

  // Get media for a post (admin only)
  getPostMedia: adminProcedure
    .input(z.object({ postId: z.number() }))
    .query(({ input }) => content.postMedia(input.postId)),

  // Delete a media attachment (admin only)
  deleteMedia: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => posts.deleteMedia(input.id)),

  // Get scheduled posts for calendar (admin only)
  scheduledPosts: adminProcedure.query(() => content.listScheduledPosts()),

  // Get post statistics for admin dashboard
  stats: adminProcedure.query(() => content.postStatistics()),
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
  articles: adminProcedure.query(() => content.listAllAdminArticles()),
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
    .mutation(({ input }) => posts.createArticle(input)),
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
    .mutation(({ input }) => posts.updateArticle(input)),
  deleteArticle: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => posts.deleteArticle(input.id)),
  cleanupMediaNames: adminProcedure.mutation(() => posts.cleanupMediaNames()),

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
    .query(({ input }) => content.listAdminPosts(input)),

  // Import YouTube videos (admin only)
  importVideos: adminProcedure
    .input(importVideosInput)
    .mutation(({ input }) => posts.importVideos(input)),

  /** Remove push tokens when deleting/deactivating a user account (manual deletion workflow). */
  purgeUserPushData: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(({ input }) => notifications.purgeUserPushData(input.userId)),
});
