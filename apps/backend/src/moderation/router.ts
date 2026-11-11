/** tRPC-маршруты модератора с проверкой роли и входных идентификаторов. */
import { z } from "zod";
import { router, moderatorProcedure } from "../_core/trpc";
import type { ModerationService } from "./moderation.service";

export const createModerationRouter = (moderation: ModerationService) =>
  router({
    listCommentReports: moderatorProcedure.query(async ({ ctx }) => {
      return moderation.listCommentReports(ctx.user);
    }),
    dismissCommentReport: moderatorProcedure
      .input(z.object({ reportId: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        moderation.dismissCommentReport({ id: ctx.user.id, sessionVersion: ctx.user.sessionVersion }, input.reportId),
      ),
    deleteReportedComment: moderatorProcedure
      .input(
        z.object({
          commentId: z.number().int().positive(),
          reportId: z.number().int().positive().optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        moderation.deleteReportedComment({ id: ctx.user.id, sessionVersion: ctx.user.sessionVersion }, input.commentId),
      ),
    blockUser: moderatorProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          reason: z.string().trim().min(3).max(512),
        }),
      )
      .mutation(({ ctx, input }) =>
        moderation.blockUser({ id: ctx.user.id, sessionVersion: ctx.user.sessionVersion }, input.userId, input.reason),
      ),
    unblockUser: moderatorProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        moderation.unblockUser({ id: ctx.user.id, sessionVersion: ctx.user.sessionVersion }, input.userId),
      ),
  });
