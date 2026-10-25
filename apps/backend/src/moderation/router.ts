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
        moderation.dismissCommentReport(ctx.user.id, input.reportId),
      ),
    deleteReportedComment: moderatorProcedure
      .input(
        z.object({
          commentId: z.number().int().positive(),
          reportId: z.number().int().positive().optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        moderation.deleteReportedComment(ctx.user.id, input.commentId),
      ),
    blockUser: moderatorProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          reason: z.string().trim().min(3).max(512),
        }),
      )
      .mutation(({ ctx, input }) =>
        moderation.blockUser(ctx.user.id, input.userId, input.reason),
      ),
    unblockUser: moderatorProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        moderation.unblockUser(ctx.user.id, input.userId),
      ),
  });
