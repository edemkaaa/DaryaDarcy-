/** Прикладные действия с жалобами и блокировками используют общие транзакционные helpers. */
import type { ContentWriteActor } from "../content/content-write-actor";
import { Injectable } from "@nestjs/common";
import * as commentDb from "../content/comments";
import * as platformDb from "../platform-db";
import type { ModerationActor } from "./user-target";

/** Адаптер проверяет вход и права; сохранение остаётся в транзакционных helpers. */
@Injectable()
export class ModerationService {
  /** Получаем ограниченный список жалоб через репозиторий с текущим служебным исполнителем. */
  listCommentReports(actor: ModerationActor) {
    return commentDb.listCommentReports(100, actor);
  }

  /** Закрываем жалобу через транзакционную проверку прав и возвращаем ok лишь после её коммита. */
  async dismissCommentReport(actor: ContentWriteActor, reportId: number) {
    await platformDb.dismissCommentReport(actor, reportId);
    return { ok: true as const };
  }

  /** Удаляем комментарий с его зависимостями через общий модерационный write-helper. */
  async deleteReportedComment(actor: ContentWriteActor, commentId: number) {
    await platformDb.deleteReportedComment(actor, commentId);
    return { ok: true as const };
  }

  /** Передаём текущую сессию исполнителя, цель и причину в атомарную блокировку с аудитом. */
  async blockUser(actor: ContentWriteActor, userId: number, reason: string) {
    await platformDb.blockUser(actor, userId, reason);
    return { ok: true as const };
  }

  /** Снимаем блокировку через ту же проверку полномочий над целевым аккаунтом. */
  async unblockUser(actor: ContentWriteActor, userId: number) {
    await platformDb.unblockUser(actor, userId);
    return { ok: true as const };
  }
}
