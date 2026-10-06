import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  clubMemberProcedure,
} from "../_core/trpc";
import * as db from "../db";
import type { ContentCommentService } from "../content/content-comment.service";
import { addCommentInput } from "../content/comment-input";
import { photoInput, uploadPhoto } from "../media/photos";
import {
  cancelProdamusSubscription,
  CLUB_PRICE,
} from "../prodamus";
import { requestClubCancellation } from "../billing/cancellation";
import type { ClubCheckoutService } from "../billing/club-checkout.service";

export const createClubRouter = (
  comments: ContentCommentService,
  checkout: ClubCheckoutService,
) =>
  router({
    list: clubMemberProcedure
      .input(
        z
          .object({
            tag: z.string().optional(),
            limit: z.number().int().min(1).max(200).default(20),
            cursor: z.number().int().nonnegative().nullish(),
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
      .mutation(({ ctx, input }) => checkout.createCheckout(ctx.user, input)),
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
      .query(({ ctx, input }) => comments.list(input.postId, ctx.user.id)),
    addComment: protectedProcedure
      .input(addCommentInput)
      .mutation(({ ctx, input }) => comments.add(ctx.user, input)),
    updateComment: protectedProcedure
      .input(
        z.object({ id: z.number(), text: z.string().trim().min(1).max(1000) }),
      )
      .mutation(({ ctx, input }) =>
        comments.update(ctx.user, input.id, input.text),
      ),
    toggleCommentLike: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(({ ctx, input }) =>
        comments.toggleLike(ctx.user, input.commentId),
      ),
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => comments.delete(ctx.user, input.id)),
    reportComment: protectedProcedure
      .input(
        z.object({ id: z.number(), reason: z.string().trim().min(3).max(512) }),
      )
      .mutation(({ ctx, input }) =>
        comments.report(ctx.user, input.id, input.reason),
      ),
    uploadCommentPhoto: protectedProcedure
      .input(photoInput)
      .mutation(async ({ ctx, input }) => {
        return uploadPhoto(input.base64, `club/comments/${ctx.user.id}`);
      }),
  });
