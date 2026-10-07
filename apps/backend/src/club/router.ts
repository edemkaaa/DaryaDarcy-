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
import type { ClubBillingServices } from "../billing/billing.module";

export const createClubRouter = (
  comments: ContentCommentService,
  billing: ClubBillingServices,
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
    subscription: publicProcedure.query(({ ctx }) =>
      billing.subscriptions.subscription(ctx.user),
    ),
    createCheckout: publicProcedure
      .input(
        z
          .object({
            email: z.string().email().optional(),
            plan: z.enum(["monthly", "semiannual"]).optional(),
          })
          .optional(),
      )
      .mutation(({ ctx, input }) =>
        billing.checkout.createCheckout(ctx.user, input),
      ),
    claimPending: protectedProcedure.mutation(({ ctx }) =>
      billing.subscriptions.claimPending(ctx.user.id),
    ),
    cancel: protectedProcedure.mutation(({ ctx }) =>
      billing.subscriptions.cancel(ctx.user.id),
    ),
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
