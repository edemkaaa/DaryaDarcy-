import { Injectable } from "@nestjs/common";
import * as commentDb from "../content/comments";
import * as platformDb from "../platform-db";
import type { ModerationActor } from "./user-target";

/** Adapters authorize/validate; persistence helpers retain transaction policies. */
@Injectable()
export class ModerationService {
  listCommentReports(actor: ModerationActor) {
    return commentDb.listCommentReports(100, actor);
  }

  async dismissCommentReport(actorUserId: number, reportId: number) {
    await platformDb.dismissCommentReport(actorUserId, reportId);
    return { ok: true as const };
  }

  async deleteReportedComment(actorUserId: number, commentId: number) {
    await platformDb.deleteReportedComment(actorUserId, commentId);
    return { ok: true as const };
  }

  async blockUser(actorUserId: number, userId: number, reason: string) {
    await platformDb.blockUser(actorUserId, userId, reason);
    return { ok: true as const };
  }

  async unblockUser(actorUserId: number, userId: number) {
    await platformDb.unblockUser(actorUserId, userId);
    return { ok: true as const };
  }
}
