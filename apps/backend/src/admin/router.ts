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
import { adminPostsPageInput } from "../content/admin-post-reads";
import { vkVideoInput } from "../content/vk-video-input";
import { upsertVkVideo } from "../content/vk-catalog";
import type { NotificationsService } from "../notifications/notifications.service";
import { articleCreationKey } from "../content/article-creation-request";
import { privateUploadInput, privateUploadStatusInput, uploadPrivateAttachment, privateAttachmentStatus } from "../content/private-attachment-uploads";
import { privateContentInput, privateContentStatusInput, uploadPrivateContentFile, privateContentFileStatus } from "../content/private-content-uploads";

export const createAdminRouter = (
  content: ContentReadService,
  posts: ContentWriteService,
  uploads: ContentUploadService,
  notifications: NotificationsService,
) => router({
  // Get all posts including unpublished (admin only)
  posts: adminProcedure.query(() => content.listAllAdminPosts()),
  postsPage: adminProcedure.input(adminPostsPageInput).query(({ input }) => content.listAdminPostsPage(input)),
  postDetail: adminProcedure.input(z.object({ id: z.number().int().positive() }).strict()).query(({ input }) => content.adminPostDetail(input.id)),

  // Create a new post (admin only)
  createPost: adminProcedure
    .input(createPostInput)
    .mutation(({ input, ctx }) => posts.createPost(ctx.user.id, input, ctx.user)),

  // Update an existing post (admin only)
  updatePost: adminProcedure
    .input(updatePostInput)
    .mutation(({ input, ctx }) => posts.updatePost(input, ctx.user)),

  // Delete a post (admin only)
  deletePost: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => posts.deletePost(input.id, ctx.user)),

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

  uploadPrivateAttachment: adminProcedure.input(privateUploadInput)
    .mutation(({ input, ctx }) => uploadPrivateAttachment(ctx.user, input)),
  privateAttachmentStatus: adminProcedure.input(privateUploadStatusInput)
    .query(({ input, ctx }) => privateAttachmentStatus(ctx.user, input.idempotencyKey)),
  uploadPrivateContentFile: adminProcedure.input(privateContentInput)
    .mutation(({ input, ctx }) => uploadPrivateContentFile(ctx.user, input)),
  privateContentFileStatus: adminProcedure.input(privateContentStatusInput)
    .query(({ input, ctx }) => privateContentFileStatus(ctx.user, input.idempotencyKey)),

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
        idempotencyKey: articleCreationKey.optional(),
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
    .mutation(({ input, ctx }) => posts.createArticle(input, ctx.user.id, ctx.user)),
  articleCreationStatus: adminProcedure
    .input(z.object({ idempotencyKey: articleCreationKey }))
    .query(({ input, ctx }) => posts.articleCreationStatus(ctx.user.id, input.idempotencyKey)),
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
    .mutation(({ input, ctx }) => posts.updateArticle(input, ctx.user)),
  deleteArticle: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => posts.deleteArticle(input.id, ctx.user)),
  cleanupMediaNames: adminProcedure.mutation(() => posts.cleanupMediaNames()),

  // Confirm a scheduled post (publish it) (admin only)
  confirmPost: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => posts.confirmPost(input.id, ctx.user)),

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
  upsertVkVideo: adminProcedure
    .input(vkVideoInput)
    .output(z.object({id:z.number().int().positive()}).strict())
    .mutation(({ctx,input})=>upsertVkVideo(ctx.user,input)),

  /** Remove push tokens when deleting/deactivating a user account (manual deletion workflow). */
  purgeUserPushData: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(({ input }) => notifications.purgeUserPushData(input.userId)),
});
