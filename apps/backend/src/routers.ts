import { COOKIE_NAME } from "../../../packages/shared/src/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { issueSession } from "./_core/oauth";
import { isValidEmail, normalizeEmail } from "./_core/password";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  moderatorProcedure,
  clubMemberProcedure,
  router,
  userHasClubAccess,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import * as platformDb from "./platform-db";
import { storagePut } from "./storage";
import { buildCheckoutUrl, buildShopCheckoutUrl, cancelProdamusSubscription, CLUB_PRICE, getShopProduct } from "./prodamus";
import {
  PEN_PAL_INTEREST_SET,
  PEN_PAL_CONSENT_VERSION,
  PEN_PAL_ADULT_CONSENT_LABEL,
} from "../../../packages/shared/src/pen-pals";
import { isRawMediaFilename } from "../../../packages/shared/src/media-label";
import { importVideoFromUrl } from "./admin-video";
import { areCommentsOpen } from "../../../packages/shared/src/club-tags";
import { normalizeRichTextForStorage, sanitizePlainPostText } from "../../../packages/shared/src/post-text-sanitize";
import { sendMarketingPostNotification, sendServicePushNotification } from "./push";
import {
  MARKETING_PUSH_CONSENT_LABEL,
  MARKETING_PUSH_CONSENT_VERSION,
} from "../../../packages/shared/src/push-consent";

// Legacy export kept for tests and index.ts cron
export async function sendNewPostNotification(
  postText: string,
  postId: number,
  target: "feed" | "club" | "both" = "feed",
) {
  return sendMarketingPostNotification(postText, postId, target);
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      const { passwordHash: _passwordHash, ...safeUser } = user;
      return safeUser;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Profile update
  profile: router({
    update: protectedProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        gender: z.enum(["female", "male"]).optional(),
        avatarUrl: z.string().url().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
    uploadAvatar: protectedProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const key = `avatars/${ctx.user.id}_${Date.now()}_${input.filename}`;
        const result = await storagePut(key, buffer, input.mimeType);
        // Also update the user's avatarUrl in DB
        await db.updateUserProfile(ctx.user.id, { avatarUrl: result.url });
        return { url: result.url };
      }),
  }),

  // Feed router
  feed: router({
    // Get published posts (public)
    list: publicProcedure
      .input(z.object({ tag: z.string().optional() }).optional())
      .query(({ input }) => {
        return db.getPosts(input?.tag);
      }),

    // Paginated posts (public) - offset-based with search
    listPaginated: publicProcedure
      .input(z.object({
        tag: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(12),
        cursor: z.number().nullish(), // offset value
      }))
      .query(({ input }) => {
        return db.getPostsPaginated({
          tagFilter: input.tag,
          search: input.search,
          limit: input.limit,
          cursor: input.cursor ?? undefined,
        });
      }),

    // Get single post by ID (public feed; club posts only for subscribers)
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const post = await db.getPostById(input.id);
        if (!post) return undefined;
        if (post.target === "club") {
          if (!ctx.user) return undefined;
          const owner = db.isOwnerAccount(ctx.user);
          const paid = await db.getActiveClubSubscription(ctx.user.id);
          if (!owner && !paid) return undefined;
        }
        return post;
      }),

    // Get all tags (public)
    tags: publicProcedure.query(() => {
      return db.getAllTags();
    }),

    // Toggle like (requires auth)
    toggleLike: protectedProcedure
      .input(z.object({ postId: z.coerce.number() }))
      .mutation(({ ctx, input }) => {
        return db.toggleLike(ctx.user.id, input.postId);
      }),

    // Toggle save/bookmark (requires auth)
    toggleSave: protectedProcedure
      .input(z.object({ postId: z.coerce.number() }))
      .mutation(({ ctx, input }) => {
        return db.toggleSave(ctx.user.id, input.postId);
      }),

    // Get user's liked and saved post IDs (requires auth)
    userInteractions: protectedProcedure.query(({ ctx }) => {
      return Promise.all([
        db.getUserLikedPostIds(ctx.user.id),
        db.getUserSavedPostIds(ctx.user.id),
      ]).then(([likedIds, savedIds]) => ({ likedIds, savedIds }));
    }),
    savedPosts: protectedProcedure.query(async ({ ctx }) => {
      const ids = await db.getUserSavedPostIds(ctx.user.id);
      const posts = await db.getPostsByIds(ids);
      const hasClub = await userHasClubAccess(ctx.user);
      if (hasClub) return posts;
      return posts.filter((post) => post.target !== "club");
    }),
  }),

  // Push notifications
  notifications: router({
    // Register device push token (public - any device can register)
    registerToken: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        platform: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.registerPushToken(input.token, ctx.user?.id, input.platform);
        return { success: true };
      }),
    marketingConsent: protectedProcedure.query(async ({ ctx }) => {
      const enabled = await db.hasMarketingPushConsent(ctx.user.id);
      return {
        enabled,
        label: MARKETING_PUSH_CONSENT_LABEL,
        version: MARKETING_PUSH_CONSENT_VERSION,
      };
    }),
    setMarketingConsent: protectedProcedure
      .input(z.object({
        enabled: z.boolean(),
        platform: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.logPushConsentEvent(
          ctx.user.id,
          "marketing",
          input.enabled ? "granted" : "revoked",
          input.platform,
          MARKETING_PUSH_CONSENT_VERSION,
          MARKETING_PUSH_CONSENT_LABEL,
        );
        return { success: true, enabled: input.enabled };
      }),
    latest: publicProcedure.query(async ({ ctx }) => {
      const feed = await db.getLatestPublishedPost("feed");
      let club: { id: number; text: string } | undefined;
      if (ctx.user) {
        const owner = db.isOwnerAccount(ctx.user);
        const paid = await db.getActiveClubSubscription(ctx.user.id);
        if (owner || paid) {
          club = await db.getLatestPublishedPost("club");
        }
      }
      return {
        feedId: feed?.id ?? null,
        feedText: feed?.text ?? "",
        clubId: club?.id ?? null,
        clubText: club?.text ?? "",
      };
    }),
  }),

  // Videos router (public)
  videos: router({
    list: publicProcedure.query(() => {
      return db.getVideos();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        return db.getVideoById(input.id);
      }),
  }),

  // Admin router for post management
  admin: router({
    // Get all posts including unpublished (admin only)
    posts: adminProcedure.query(() => {
      return db.getAllPostsAdmin();
    }),

    // Create a new post (admin only)
    createPost: adminProcedure
      .input(z.object({
        text: z.string().min(1),
        photos: z.array(z.string()),
        tags: z.array(z.string()),
        videos: z.array(z.string()).optional(),
        source: z.string().default("manual"),
        published: z.boolean().default(true),
        sortOrder: z.number().default(0),
        status: z.enum(["draft", "scheduled", "published"]).default("published"),
        target: z.enum(["feed", "club", "both"]).default("feed"),
        scheduledAt: z.string().nullable().optional(), // ISO date string
        publishedAt: z.string().nullable().optional(),
        richText: z.any().optional(), // JSON rich text blocks
      }))
      .mutation(async ({ input }) => {
        const { scheduledAt, publishedAt, published, status, videos = [], ...rest } = input;
        const text = sanitizePlainPostText(rest.text);
        const richText = normalizeRichTextForStorage(rest.richText, text);
        const tags = videos.length > 0 && !rest.tags.includes("video")
          ? [...rest.tags, "video"]
          : rest.tags;
        const resolvedStatus =
          status === "scheduled"
            ? "scheduled"
            : published === false || status === "draft"
              ? "draft"
              : "published";
        const postData = {
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
        const postId = await db.createPost(postData as any);
        if (videos.length > 0) {
          await db.replacePostVideos(postId, videos);
        }
        if (resolvedStatus === "published") {
          sendNewPostNotification(text, postId, rest.target);
        }
        return postId;
      }),

    // Update an existing post (admin only)
    updatePost: adminProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ input }) => {
        const { id, scheduledAt, publishedAt, videos, ...data } = input;
        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) updateData[key] = value;
        }
        if (typeof data.text === "string") {
          updateData.text = sanitizePlainPostText(data.text);
        }
        if (data.richText !== undefined) {
          const plain = typeof updateData.text === "string"
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
        if (videos !== undefined && videos.length > 0 && Array.isArray(data.tags) && !data.tags.includes("video")) {
          updateData.tags = [...data.tags, "video"];
        }
        if (scheduledAt !== undefined) {
          updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
        }
        if (publishedAt !== undefined) {
          updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
        }
        if (data.status === "published" && publishedAt === undefined) {
          const existing = await db.getPostById(id);
          if (existing && !existing.publishedAt) {
            updateData.publishedAt = new Date();
          }
        }
        if (data.status !== undefined) {
          updateData.published = data.status === "published";
        }
        // If publishing (draft/scheduled → published), send notification
        if (data.status === "published") {
          const existing = await db.getPostById(id);
          if (existing && existing.status !== "published") {
            sendNewPostNotification(data.text || existing.text, id, data.target || existing.target);
          }
        }
        await db.updatePost(id, updateData);
        if (videos !== undefined) {
          await db.replacePostVideos(id, videos);
        }
        return { success: true };
      }),

    // Delete a post (admin only)
    deletePost: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        return db.deletePost(input.id);
      }),

    importVideoUrl: adminProcedure
      .input(z.object({
        url: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        return importVideoFromUrl(input.url);
      }),

    // Upload photo (admin only)
    uploadPhoto: adminProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const key = `feed/photos/${Date.now()}_${input.filename}`;
        const result = await storagePut(key, buffer, input.mimeType);
        return { url: result.url };
      }),

    // Upload media file (video/audio/document) (admin only)
    uploadMedia: adminProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        type: z.enum(["video", "audio", "document"]),
        postId: z.number().optional(),
        duration: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const folder = input.type === "video" ? "videos" : input.type === "audio" ? "audio" : "documents";
        const safeName = isRawMediaFilename(input.filename) ? `${input.type}-${Date.now()}` : input.filename;
        const storedName = isRawMediaFilename(input.filename) ? null : input.filename;
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
      .input(z.object({
        title: z.string().trim().min(1).max(255),
        coverUrl: z.string().nullable().optional(),
        access: z.enum(["public", "club"]).default("club"),
        published: z.boolean().default(true),
        sortOrder: z.number().optional(),
        sections: z.array(z.object({
          type: z.enum(["heading", "text", "photo", "png", "link", "carousel"]),
          text: z.string().optional().default(""),
          url: z.string().optional().default(""),
          label: z.string().optional().default(""),
          caption: z.string().optional().default(""),
          urls: z.array(z.string()).optional().default([]),
        })),
      }))
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
      .input(z.object({
        id: z.number(),
        title: z.string().trim().min(1).max(255).optional(),
        coverUrl: z.string().nullable().optional(),
        access: z.enum(["public", "club"]).optional(),
        published: z.boolean().optional(),
        sortOrder: z.number().optional(),
        sections: z.array(z.object({
          type: z.enum(["heading", "text", "photo", "png", "link", "carousel"]),
          text: z.string().optional().default(""),
          url: z.string().optional().default(""),
          label: z.string().optional().default(""),
          caption: z.string().optional().default(""),
          urls: z.array(z.string()).optional().default([]),
        })).optional(),
      }))
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
        await db.confirmScheduledPost(input.id);
        const post = await db.getPostById(input.id);
        if (post) {
          sendNewPostNotification(post.text, input.id, post.target);
        }
        return { success: true };
      }),

    // Get admin posts filtered by status/target
    postsFiltered: adminProcedure
      .input(z.object({
        status: z.enum(["draft", "scheduled", "published"]).optional(),
        target: z.enum(["feed", "club", "both"]).optional(),
      }).optional())
      .query(({ input }) => {
        return db.getAdminPostsFiltered(input);
      }),

    // Import YouTube videos (admin only)
    importVideos: adminProcedure
      .input(z.object({
        videos: z.array(z.object({
          youtubeId: z.string(),
          title: z.string(),
          duration: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          views: z.string().optional(),
          publishedText: z.string().optional(),
        })),
      }))
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
  }),

  club: router({
    list: clubMemberProcedure
      .input(z.object({
        tag: z.string().optional(),
        limit: z.number().min(1).max(200).default(20),
        cursor: z.number().nullish(),
      }).optional())
      .query(({ input }) => {
        return db.getPostsForTarget("club", {
          tagFilter: input?.tag,
          limit: input?.limit ?? 20,
          cursor: input?.cursor ?? undefined,
        });
      }),
    subscription: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        return {
          subscribed: false,
          expiresAt: null as Date | null,
          cancelAtPeriodEnd: false,
          isOwner: false,
          monthlyPrice: CLUB_PRICE,
        };
      }
      const owner = db.isOwnerAccount(ctx.user);
      const paid = await db.getActiveClubSubscription(ctx.user.id);
      return {
        subscribed: owner || Boolean(paid),
        expiresAt: paid?.expiresAt ?? null,
        cancelAtPeriodEnd: Boolean(paid?.cancelAtPeriodEnd),
        isOwner: owner,
        monthlyPrice: CLUB_PRICE,
      };
    }),
    createCheckout: publicProcedure
      .input(z.object({
        email: z.string().email().optional(),
        plan: z.enum(["monthly", "semiannual"]).optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input?.email || ctx.user?.email || "");
        if (!isValidEmail(email)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Укажите почту для оплаты" });
        }
        let user = ctx.user;
        let sessionUser: {
          id: number;
          openId: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          loginMethod: string | null;
          gender: "female" | "male" | null;
          avatarUrl: string | null;
          lastSignedIn: string;
          role: string;
        } | null = null;
        if (!user) {
          const existing = await db.getUserByEmail(email);
          if (existing?.passwordHash) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Этот email уже зарегистрирован. Войдите, затем нажмите Оплатить.",
            });
          }
          user = existing || await db.ensureUserByEmail(email);
          await issueSession(ctx.req, ctx.res, user);
          sessionUser = {
            id: user.id,
            openId: user.openId,
            name: user.name,
            email: user.email,
            phone: user.phone,
            loginMethod: user.loginMethod,
            gender: user.gender ?? null,
            avatarUrl: user.avatarUrl ?? null,
            lastSignedIn: new Date(user.lastSignedIn).toISOString(),
            role: user.role || "user",
          };
        }
        const plan = input?.plan ?? "monthly";
        const orderId = plan === "semiannual"
          ? `club6m-${user.id}-${Date.now()}`
          : `club-${user.id}-${Date.now()}`;
        await db.createClubPayment({ userId: user.id, orderId, email });
        return {
          url: buildCheckoutUrl({ orderId, email, userId: user.id, plan }),
          user: sessionUser,
        };
      }),
    claimPending: protectedProcedure.mutation(async ({ ctx }) => {
      const already = await db.getActiveClubSubscription(ctx.user.id);
      if (already) {
        return { granted: true as const, orderId: already.orderId };
      }
      const result = await db.activateLatestPendingClubPayment(ctx.user.id);
      return { granted: result.granted, orderId: result.orderId ?? null };
    }),
    cancel: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await db.cancelClubSubscription(ctx.user.id);
      if (!result.cancelled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нет активной подписки" });
      }
      const email = (ctx.user.email || "").trim();
      if (email) {
        await cancelProdamusSubscription(email);
      }
      return { ok: true as const, expiresAt: result.expiresAt };
    }),
    comments: clubMemberProcedure
      .input(z.object({ postId: z.number() }))
      .query(({ ctx, input }) => platformDb.listPostCommentsV2(input.postId, ctx.user.id)),
    addComment: protectedProcedure
      .input(z.object({
        postId: z.number(),
        text: z.string().trim().min(1).max(1000),
        parentId: z.number().optional(),
        photos: z.array(z.string().url()).max(2).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const post = await db.getPostById(input.postId);
        if (!post || !post.published) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден" });
        }
        if (post.target === "club" && !(await userHasClubAccess(ctx.user))) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Доступно только участницам клуба Darcy",
          });
        }
        if (!areCommentsOpen(post.tags as string[], post.publishedAt ?? post.createdAt)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Комментарии к этому посту закрыты" });
        }
        const id = await platformDb.addPostCommentV2({
          postId: input.postId,
          userId: ctx.user.id,
          text: input.text,
          parentId: input.parentId,
          photos: input.photos,
        });
        if (input.parentId) {
          const parent = await platformDb.getPostCommentById(input.parentId);
          if (parent && parent.userId !== ctx.user.id) {
            const preview = input.text.length > 80 ? `${input.text.slice(0, 80)}…` : input.text;
            const author = (ctx.user.name || "Участница").trim();
            void sendServicePushNotification({
              userId: parent.userId,
              title: "Ответ на ваш комментарий",
              body: `${author}: ${preview}`,
              data: { postId: input.postId, type: "comment_reply", commentId: input.parentId },
              target: "club",
            });
          }
        }
        return { id };
      }),
    updateComment: protectedProcedure
      .input(z.object({ id: z.number(), text: z.string().trim().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        await platformDb.updatePostCommentV2(input.id, ctx.user.id, input.text);
        return { ok: true as const };
      }),
    toggleCommentLike: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return platformDb.toggleCommentLike(ctx.user.id, input.commentId);
      }),
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const staff = platformDb.isStaffAccount(ctx.user);
        await platformDb.deletePostCommentV2(input.id, ctx.user.id, staff);
        return { ok: true as const };
      }),
    reportComment: protectedProcedure
      .input(z.object({ id: z.number(), reason: z.string().trim().min(3).max(512) }))
      .mutation(async ({ ctx, input }) => {
        await platformDb.reportComment(input.id, ctx.user.id, input.reason);
        return { ok: true as const };
      }),
    uploadCommentPhoto: protectedProcedure
      .input(z.object({
        base64: z.string().max(6_000_000),
        filename: z.string().max(128),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 4 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Фото больше 4 МБ" });
        }
        const ext = input.mimeType.includes("png")
          ? "png"
          : input.mimeType.includes("webp")
            ? "webp"
            : "jpg";
        const key = `club/comments/${ctx.user.id}/${Date.now()}.${ext}`;
        const result = await storagePut(key, buffer, input.mimeType);
        return { url: result.url };
      }),
  }),

  penPals: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getPenPalProfile(ctx.user.id);
      if (!profile || !profile.active) return null;
      return {
        fullName: profile.fullName || profile.city,
        interests: Array.isArray(profile.interests) ? profile.interests : [],
        address: profile.address,
      };
    }),
    upsert: protectedProcedure
      .input(z.object({
        fullName: z.string().trim().min(2).max(128),
        interests: z.array(z.string()).min(2).max(3),
        address: z.string().trim().min(5).max(1000),
        adultConsent: z.literal(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const unique = [...new Set(input.interests)];
        if (unique.length < 2 || unique.some((interest) => !PEN_PAL_INTEREST_SET.has(interest))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Выберите 2–3 темы из списка" });
        }
        const profile = await platformDb.upsertPenPalProfileV2(ctx.user.id, {
          fullName: input.fullName,
          interests: unique,
          address: input.address,
          consentVersion: PEN_PAL_CONSENT_VERSION,
        });
        await platformDb.logUserConsent(
          ctx.user.id,
          "pen_pals_adult",
          "granted",
          PEN_PAL_CONSENT_VERSION,
          PEN_PAL_ADULT_CONSENT_LABEL,
        );
        return {
          fullName: profile.fullName || profile.city,
          interests: unique,
          address: profile.address,
        };
      }),
    find: protectedProcedure.mutation(async ({ ctx }) => {
      const profile = await db.getPenPalProfile(ctx.user.id);
      if (!profile || !profile.active) {
        return { needsProfile: true as const, matches: [] as platformDb.PenPalMatchCard[] };
      }
      const matches = await platformDb.listPenPalCards(ctx.user.id, 4);
      return { needsProfile: false as const, matches };
    }),
    requestMatch: protectedProcedure
      .input(z.object({ targetUserId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const matchId = await platformDb.requestPenPalMatch(ctx.user.id, input.targetUserId);
        return { matchId };
      }),
    respondMatch: protectedProcedure
      .input(z.object({ matchId: z.number(), accept: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await platformDb.respondPenPalMatch(ctx.user.id, input.matchId, input.accept);
        return { ok: true as const };
      }),
    remove: protectedProcedure.mutation(async ({ ctx }) => {
      await platformDb.deactivatePenPalProfileV2(ctx.user.id);
      await platformDb.logUserConsent(
        ctx.user.id,
        "pen_pals_adult",
        "revoked",
        PEN_PAL_CONSENT_VERSION,
        PEN_PAL_ADULT_CONSENT_LABEL,
      );
      return { success: true as const };
    }),
    consentLabel: publicProcedure.query(() => ({
      label: PEN_PAL_ADULT_CONSENT_LABEL,
      version: PEN_PAL_CONSENT_VERSION,
    })),
  }),

  shop: router({
    owned: publicProcedure
      .input(z.object({ productId: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) return { owned: false };
        return { owned: await db.userOwnsShopProduct(ctx.user.id, input.productId) };
      }),
    createCheckout: protectedProcedure
      .input(z.object({ productId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const product = getShopProduct(input.productId);
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Товар не найден" });
        }
        const email = (ctx.user.email || "").trim();
        if (!email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Для оплаты нужна почта в профиле" });
        }
        const orderId = `shop-${input.productId}-${Date.now()}`;
        await db.createShopPurchase({
          userId: ctx.user.id,
          productId: input.productId,
          orderId,
          email,
        });
        const url = buildShopCheckoutUrl({
          productId: input.productId,
          orderId,
          email,
          userId: ctx.user.id,
        });
        if (!url) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Не удалось создать оплату" });
        }
        return { url };
      }),
  }),

  moderation: router({
    listCommentReports: moderatorProcedure.query(async () => {
      return platformDb.listCommentReports(100);
    }),
    dismissCommentReport: moderatorProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await platformDb.dismissCommentReport(input.reportId);
        await platformDb.logAdminAction({
          actorUserId: ctx.user.id,
          action: "dismiss_comment_report",
          targetType: "comment_report",
          targetId: input.reportId,
        });
        return { ok: true as const };
      }),
    deleteReportedComment: moderatorProcedure
      .input(z.object({ commentId: z.number(), reportId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await platformDb.deleteCommentAndReports(input.commentId);
        await platformDb.logAdminAction({
          actorUserId: ctx.user.id,
          action: "delete_reported_comment",
          targetType: "comment",
          targetId: input.commentId,
        });
        return { ok: true as const };
      }),
    blockUser: moderatorProcedure
      .input(z.object({ userId: z.number(), reason: z.string().trim().min(3).max(512) }))
      .mutation(async ({ ctx, input }) => {
        await platformDb.blockUser(ctx.user.id, input.userId, input.reason);
        return { ok: true as const };
      }),
    unblockUser: moderatorProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await platformDb.unblockUser(ctx.user.id, input.userId);
        return { ok: true as const };
      }),
  }),

  profileExtras: router({
    requestAccountDeletion: protectedProcedure.mutation(async ({ ctx }) => {
      await platformDb.requestAccountDeletion(ctx.user.id);
      return { ok: true as const };
    }),
  }),

  articles: router({
    list: publicProcedure.query(async () => {
      const rows = await db.listPublishedArticles();
      return rows
        .filter((row) => row.access === "public")
        .map((row) => ({
          id: row.id,
          title: row.title,
          coverUrl: row.coverUrl,
          access: row.access,
        }));
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const article = await db.getArticleById(input.id);
        if (!article || !article.published) return undefined;
        const user = ctx.user;
        const allowed = user
          ? db.isOwnerAccount(user) || Boolean(await db.getActiveClubSubscription(user.id))
          : false;
        if (!allowed) {
          return {
            id: article.id,
            title: article.title,
            coverUrl: article.coverUrl,
            access: article.access,
            locked: true as const,
            sections: [],
          };
        }
        return {
          id: article.id,
          title: article.title,
          coverUrl: article.coverUrl,
          access: article.access,
          locked: false as const,
          sections: article.sections || [],
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
