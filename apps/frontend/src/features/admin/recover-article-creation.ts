/** Восстановление сначала проверяет исходную операцию создания и её файлы, чтобы не создавать вторую статью после потери ответа. */
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import {
  type ArticleCreationJournal,
  parseArticleCreationStatus,
  type ArticleCreationRecord,
} from "@/domain/content/article-creation-journal";
import {
  matchesEditableWrite,
  withExpectedRevision,
} from "@/domain/content/edit-revision";
import {
  recoverArticleFileUploads,
  sealArticleFileWrite,
} from "@/domain/content/article-file-save";
import type { PrivateContentApi } from "@/shared/media/private-content-upload";
import { requireOk } from "@/shared/api/action-result";
import { getHttpStatus, invalidResponse } from "@/shared/api/errors";
import { privateUploadRejectionMessage } from "@/shared/api/upload-errors";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";

type ArticleRecoveryDependencies = {
  operation: { begin: (kind: string) => ScopedOperation | null };
  journal: ArticleCreationJournal;
  fileApi: PrivateContentApi;
  api: Pick<
    TRPCClient<AppRouter>["admin"],
    "createArticle" | "updateArticle" | "articleCreationStatus"
  >;
  readUpdatedArticle: (
    id: number,
    task: ScopedOperation,
  ) => Promise<Record<string, unknown>>;
  completeCreation: (
    record: ArticleCreationRecord,
    task: ScopedOperation,
  ) => Promise<void>;
  setCreation: (record: ArticleCreationRecord) => void;
  setEditConflict: (status: 409 | 412) => void;
  setServerComparison: (detail: Record<string, unknown>) => void;
  setRecoveryMessage: (message: string) => void;
  notify: (message: string) => void;
};

/** Check before replay; retain the original operation until completion is confirmed. */
export async function recoverArticleCreation(
  creation: ArticleCreationRecord | null,
  replay: boolean,
  {
    operation,
    journal,
    fileApi,
    api,
    readUpdatedArticle,
    completeCreation,
    setCreation,
    setEditConflict,
    setServerComparison,
    setRecoveryMessage,
    notify,
  }: ArticleRecoveryDependencies,
) {
  if (!creation) return;
  let record = creation;
  const task = operation.begin("recover-article");
  if (!task) return;
  try {
    await journal.requireCurrent(record);
    task.assertCurrent();
    if (record.media?.phase === "upload") {
      record = await recoverArticleFileUploads(
        record,
        journal,
        fileApi,
        task,
        setCreation,
      );
      if (!replay) {
        setRecoveryMessage(
          "Файлы подтверждены. Нажмите «Повторить сохранение», чтобы сохранить статью с исходными данными.",
        );
        return;
      }
      record = await sealArticleFileWrite(record, journal, task);
      setCreation(record);
      if (record.media?.editingId) {
        const result = await api.updateArticle.mutate(
          withExpectedRevision(
            { id: record.media.editingId, ...record.payload },
            record.editBase?.revision,
          ),
          { signal: task.signal },
        );
        requireOk(result);
        task.assertCurrent();
        await readUpdatedArticle(record.media.editingId, task);
        await completeCreation(record, task);
        return;
      }
    } else if (record.media?.editingId) {
      const detail = await readUpdatedArticle(record.media.editingId, task);
      if (matchesEditableWrite(detail, record.payload, "article")) {
        await completeCreation(record, task);
        return;
      }
      setServerComparison(detail);
      setRecoveryMessage(
        "Результат изменения не подтверждён. Список обновлён. Проверьте статью; повторная запись не выполнялась.",
      );
      return;
    }
    const status = parseArticleCreationStatus(
      await api.articleCreationStatus.query(
        { idempotencyKey: record.idempotencyKey },
        { signal: task.signal },
      ),
    );
    task.assertCurrent();
    if (status.status !== "notRecorded") {
      await completeCreation(record, task);
      notify(
        status.status === "deleted"
          ? `Статья №${status.articleId} была создана и затем удалена. Замена не создавалась.`
          : `Создание статьи №${status.articleId} подтверждено.`,
      );
      return;
    }
    if (!replay) {
      setRecoveryMessage(
        "Создание пока не подтверждено. Первый запрос ещё может завершиться. Можно повторить сохранение с исходными данными; новая статья автоматически не создаётся.",
      );
      return;
    }
    await journal.requireCurrent(record);
    task.assertCurrent();
    const id = await api.createArticle.mutate(
      { ...record.payload, idempotencyKey: record.idempotencyKey },
      { signal: task.signal },
    );
    if (!Number.isSafeInteger(id) || id <= 0) throw invalidResponse();
    task.assertCurrent();
    await completeCreation(record, task);
  } catch (error) {
    checkOperationAccessError(error);
    const revisionStatus = getHttpStatus(error);
    if (
      task.isCurrent() &&
      record.media?.editingId &&
      record.media.phase === "write" &&
      (revisionStatus === 409 || revisionStatus === 412)
    ) {
      setEditConflict(revisionStatus);
      try {
        const next = await journal.recordConflict(record, revisionStatus);
        task.assertCurrent();
        setCreation(next);
      } catch {
        /* Keep the immutable original when storage cannot checkpoint. */
      }
    }
    const uploadRejection =
      record.media?.phase === "upload"
        ? privateUploadRejectionMessage(error)
        : null;
    if (task.isCurrent())
      setRecoveryMessage(
        uploadRejection
          ? `${uploadRejection} Исходные файлы сохранены на этом устройстве. Проверьте загрузку позже.`
          : getHttpStatus(error) === 409
            ? "Сервер сообщил конфликт данных этой операции. Исходный ключ сохранён. Проверьте результат сохранения; новая операция не создавалась."
            : "Не удалось подтвердить сохранение статьи. Исходные данные и ключ сохранены. Проверьте результат ещё раз.",
      );
  } finally {
    task.finish();
  }
}
