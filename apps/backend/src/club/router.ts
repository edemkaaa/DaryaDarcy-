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
import { commentsPageInput } from "../content/comments-page";
import { clubCategoryInput } from "../content/club-category-filter";
import { photoInput, uploadPhoto } from "../media/photos";
import { privateCommentPhotoInput, privateContentStatusInput, uploadPrivateContentFile, privateContentFileStatus } from "../content/private-content-uploads";
import type { ClubBillingServices } from "../billing/billing.module";
import { enforceReturnCheckLimit } from "../billing/yookassa/return-check-limit";
import { enforceLegacyCheckoutLimit } from "../billing/legacy-checkout-limit";
import {
  createGuestNormalCheckout,
  guestNormalCheckoutStatus,
  guestCheckoutInput,
  guestCheckoutProof,
  enforceGuestCheckoutLimit,
} from "../billing/guest-normal-checkout";
import {
  createNormalCheckout,
  normalCheckoutInput,
  normalCheckoutKey,
  normalCheckoutStatus,
  normalCheckoutResult,
  normalCheckoutStatusResult,
} from "../billing/normal-checkout";

export const createClubRouter = (
  comments: ContentCommentService,
  billing: ClubBillingServices,
) =>
  router({
    createGuestNormalCheckout: publicProcedure
      .input(guestCheckoutInput)
      .output(normalCheckoutResult)
      .mutation(({ ctx, input }) => {
        enforceGuestCheckoutLimit(ctx.req, ctx.res, input);
        return createGuestNormalCheckout(input, ctx.req.headers?.["idempotency-key"], ctx.user);
      }),
    guestNormalCheckoutStatus: publicProcedure
      .input(guestCheckoutProof)
      .output(normalCheckoutStatusResult)
      .mutation(({ ctx, input }) => {
        enforceGuestCheckoutLimit(ctx.req, ctx.res, input);
        return guestNormalCheckoutStatus(input, ctx.user);
      }),
    listByCategory: clubMemberProcedure.input(clubCategoryInput)
      .query(({ input }) => db.getPostsForTarget("club", {
        category: input.category, clubTag: input.tag, limit: input.limit,
        cursor: input.cursor ?? undefined,
      })),
    normalCheckoutStatus: protectedProcedure
      .input(z.object({ idempotencyKey: normalCheckoutKey }).strict())
      .output(normalCheckoutStatusResult)
      .query(({ ctx, input }) =>
        normalCheckoutStatus(ctx.user, input.idempotencyKey),
      ),
    createNormalCheckout: protectedProcedure
      .input(normalCheckoutInput)
      .output(normalCheckoutResult)
      .mutation(({ ctx, input }) =>
        createNormalCheckout(
          ctx.user,
          input,
          ctx.req.headers?.["idempotency-key"],
        ),
      ),
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
    reconcileCheckout: publicProcedure
      .use(({ ctx, next }) => {
        enforceReturnCheckLimit(ctx.req, ctx.res);
        return next();
      })
      .input(z.undefined())
      .output(
        z
          .object({
            state: z.enum(["unknown", "pending", "succeeded", "canceled"]),
          })
          .strict(),
      )
      .mutation(({ ctx }) =>
        billing.checkout.reconcileCheckout(
          ctx.user,
          ctx.req.headers?.["idempotency-key"],
        ),
      ),
    createCheckout: publicProcedure
      .use(({ ctx, next }) => {
        enforceLegacyCheckoutLimit(ctx.req, ctx.res, ctx.user?.id);
        return next();
      })
      .input(
        z
          .object({
            email: z.string().email().optional(),
            contactPhone: z.string().max(40).optional(),
            plan: z.enum(["monthly", "semiannual"]).optional(),
          })
          .optional(),
      )
      .mutation(({ ctx, input }) =>
        billing.checkout.createCheckout(
          ctx.user,
          input,
          ctx.req.headers?.["idempotency-key"],
        ),
      ),
    claimPending: protectedProcedure.mutation(({ ctx }) =>
      billing.subscriptions.claimPending(ctx.user.id),
    ),
    cancel: protectedProcedure.mutation(({ ctx }) =>
      billing.subscriptions.cancel(ctx.user.id),
    ),
    comments: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .query(({ ctx, input }) => comments.list(input.postId, ctx.user)),
    commentsPage: protectedProcedure.input(commentsPageInput)
      .query(({ ctx, input }) => comments.listPage(input, ctx.user)),
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
    uploadPrivateCommentPhoto: protectedProcedure.input(privateCommentPhotoInput)
      .mutation(({ ctx, input }) => uploadPrivateContentFile(ctx.user, input)),
    privateCommentPhotoStatus: protectedProcedure.input(privateContentStatusInput)
      .query(({ ctx, input }) => privateContentFileStatus(ctx.user, input.idempotencyKey, true)),
    uploadCommentPhoto: protectedProcedure
      .input(photoInput)
      .mutation(async ({ ctx, input }) => {
        return uploadPhoto(input.base64, `club/comments/${ctx.user.id}`);
      }),
  });
