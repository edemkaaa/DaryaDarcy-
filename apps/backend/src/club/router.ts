import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  clubMemberProcedure,
  userHasClubAccess,
} from "../_core/trpc";
import { isValidEmail, normalizeEmail } from "../_core/password";
import * as db from "../db";
import * as platformDb from "../platform-db";
import * as commentDb from "../content/comments";
import { photoInput, uploadPhoto } from "../media/photos";
import {
  buildCheckoutUrl,
  cancelProdamusSubscription,
  CLUB_PRICE,
  CLUB_SEMIANNUAL_PRICE,
} from "../prodamus";
import { requestClubCancellation } from "../billing/cancellation";
import { areCommentsOpen } from "../../../../packages/shared/src/club-tags";
import { sendServicePushNotification } from "../push";

async function requireReadableComment(
  id: number,
  user: Parameters<typeof userHasClubAccess>[0],
) {
  const comment = await commentDb.getPostCommentById(id);
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

export const clubRouter = router({
  list: clubMemberProcedure
    .input(
      z
        .object({
          tag: z.string().optional(),
          limit: z.number().min(1).max(200).default(20),
          cursor: z.number().nullish(),
        })
        .optional(),
    )
    .query(({ input }) => {
      return db.getPostsForTarget("club", {
        tagFilter: input?.tag,
        limit: input?.limit ?? 20,
        cursor: input?.cursor ?? undefined,
      });
    }),
  subscription: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user || ctx.user.blockedAt) {
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
    .input(
      z
        .object({
          email: z.string().email().optional(),
          plan: z.enum(["monthly", "semiannual"]).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input?.email || ctx.user?.email || "");
      if (!isValidEmail(email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Укажите почту для оплаты",
        });
      }
      if (ctx.user && email !== normalizeEmail(ctx.user.email || "")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Используйте почту своего аккаунта",
        });
      }
      const existing = await db.getUserByEmail(email);
      if (ctx.user?.blockedAt || existing?.blockedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Не удалось создать платёж. Обратитесь в поддержку.",
        });
      }
      // A billing recipient is not an authenticated identity. Never issue a
      // session or expose account details merely because an email was supplied.
      const user = ctx.user || existing || (await db.ensureUserByEmail(email));
      const plan = input?.plan ?? "monthly";
      const orderId =
        plan === "semiannual"
          ? `club6m-${user.id}-${Date.now()}`
          : `club-${user.id}-${Date.now()}`;
      await db.createClubPayment({
        userId: user.id,
        orderId,
        email,
        sum: plan === "semiannual" ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE,
      });
      return {
        url: buildCheckoutUrl({ orderId, email, userId: user.id, plan }),
        user: null,
      };
    }),
  claimPending: protectedProcedure.mutation(async ({ ctx }) => {
    const already = await db.getActiveClubSubscription(ctx.user.id);
    if (already) {
      return { granted: true as const, orderId: already.orderId };
    }
    // Compatibility endpoint for the current client: report verified access,
    // never turn a checkout into a paid subscription.
    return { granted: false as const, orderId: null };
  }),
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    let result;
    try {
      result = await requestClubCancellation(
        database,
        ctx.user.id,
        cancelProdamusSubscription,
      );
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Не удалось определить подписку. Обратитесь в поддержку.",
      });
    }
    if (!result.confirmed)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Запрос отмены сохранён, но платёжная система пока не подтвердила отмену. Мы повторим попытку. До подтверждения автосписание может оставаться активным.",
      });
    return { ok: true as const, expiresAt: result.expiresAt };
  }),
  comments: clubMemberProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const post = await db.getPostById(input.postId);
      if (!post || !post.published || post.status !== "published") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден" });
      }
      return commentDb.listPostCommentsV2(input.postId, ctx.user.id);
    }),
  addComment: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        text: z.string().trim().min(1).max(1000),
        parentId: z.number().optional(),
        photos: z.array(z.string().url()).max(2).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostById(input.postId);
      if (!post || !post.published || post.status !== "published") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден" });
      }
      if (post.target === "club" && !(await userHasClubAccess(ctx.user))) {
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
      const id = await commentDb.addPostCommentV2({
        postId: input.postId,
        userId: ctx.user.id,
        text: input.text,
        parentId: input.parentId,
        photos: input.photos,
      });
      if (input.parentId) {
        const parent = await commentDb.getPostCommentById(input.parentId);
        if (parent && parent.userId !== ctx.user.id) {
          const preview =
            input.text.length > 80 ? `${input.text.slice(0, 80)}…` : input.text;
          const author = (ctx.user.name || "Участница").trim();
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
    }),
  updateComment: protectedProcedure
    .input(
      z.object({ id: z.number(), text: z.string().trim().min(1).max(1000) }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReadableComment(input.id, ctx.user);
      await commentDb.updatePostCommentV2(input.id, ctx.user.id, input.text);
      return { ok: true as const };
    }),
  toggleCommentLike: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireReadableComment(input.commentId, ctx.user);
      return commentDb.toggleCommentLike(ctx.user.id, input.commentId);
    }),
  deleteComment: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireReadableComment(input.id, ctx.user);
      const staff = platformDb.isStaffAccount(ctx.user);
      await commentDb.deletePostCommentV2(input.id, ctx.user.id, staff);
      return { ok: true as const };
    }),
  reportComment: protectedProcedure
    .input(
      z.object({ id: z.number(), reason: z.string().trim().min(3).max(512) }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireReadableComment(input.id, ctx.user);
      await commentDb.reportComment(input.id, ctx.user.id, input.reason);
      return { ok: true as const };
    }),
  uploadCommentPhoto: protectedProcedure
    .input(photoInput)
    .mutation(async ({ ctx, input }) => {
      return uploadPhoto(input.base64, `club/comments/${ctx.user.id}`);
    }),
});
