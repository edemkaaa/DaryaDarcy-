/** Прикладные действия с жалобами и блокировками используют общие транзакционные helpers. */
import type { ContentWriteActor } from "../content/content-write-actor";
import { Injectable } from "@nestjs/common";
import * as commentDb from "../content/comments";
import * as platformDb from "../platform-db";
import type { ModerationActor } from "./user-target";

/** Адаптер проверяет вход и права; сохранение остаётся в транзакционных helpers. */
@Injectable()
export class ModerationService {
  listCommentReports(actor: ModerationActor) {
    return commentDb.listCommentReports(100, actor);
  }

  async dismissCommentReport(actor: ContentWriteActor, reportId: number) {
    await platformDb.dismissCommentReport(actor, reportId);
    return { ok: true as const };
  }

  async deleteReportedComment(actor: ContentWriteActor, commentId: number) {
    await platformDb.deleteReportedComment(actor, commentId);
    return { ok: true as const };
  }

  async blockUser(actor: ContentWriteActor, userId: number, reason: string) {
    await platformDb.blockUser(actor, userId, reason);
    return { ok: true as const };
  }

  async unblockUser(actor: ContentWriteActor, userId: number) {
    await platformDb.unblockUser(actor, userId);
    return { ok: true as const };
  }
}
