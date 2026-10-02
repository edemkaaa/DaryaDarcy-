import { z } from "zod";
import { router, moderatorProcedure } from "../_core/trpc";
import * as commentDb from "../content/comments";
import * as platformDb from "../platform-db";

export const moderationRouter = router({
  listCommentReports: moderatorProcedure.query(async () => {
    return commentDb.listCommentReports(100);
  }),
  dismissCommentReport: moderatorProcedure
    .input(z.object({ reportId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await commentDb.dismissCommentReport(input.reportId);
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
      await commentDb.deleteCommentAndReports(input.commentId);
      await platformDb.logAdminAction({
        actorUserId: ctx.user.id,
        action: "delete_reported_comment",
        targetType: "comment",
        targetId: input.commentId,
      });
      return { ok: true as const };
    }),
  blockUser: moderatorProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string().trim().min(3).max(512),
      }),
    )
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
});
