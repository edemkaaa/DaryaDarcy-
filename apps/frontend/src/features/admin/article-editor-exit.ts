/** Уход из редактора различает локальный черновик и отправленную операцию; очистка одного не отменяет запись на сервере. */
import type {
  ArticleCreationJournal,
  ArticleCreationRecord,
} from "@/domain/content/article-creation-journal";
import {
  checkOperationAccessError,
  type useSessionOperation,
} from "@/domain/session/use-session-operation";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import type { useArticleDraft } from "./use-article-draft";

type ArticleEditorExitDependencies = {
  creation: ArticleCreationRecord | null;
  operation: Pick<ReturnType<typeof useSessionOperation>, "begin" | "cancel">;
  draft: Pick<ReturnType<typeof useArticleDraft>, "record" | "clear" | "flush">;
  journal: Pick<ArticleCreationJournal, "load" | "clear">;
  cover: { pending: boolean };
  readCurrentArticles: (task: ScopedOperation) => Promise<void>;
  setCreation: (record: ArticleCreationRecord | null) => void;
  setRecoveryMessage: (message: string | null) => void;
  refreshRelatedContent: () => void;
  reset: () => void;
};

/** Keep completion, cancellation and explicit discard as distinct ordered paths. */
export function createArticleEditorExit({
  creation,
  operation,
  draft,
  journal,
  cover,
  readCurrentArticles,
  setCreation,
  setRecoveryMessage,
  refreshRelatedContent,
  reset,
}: ArticleEditorExitDependencies) {
  // Разделяет завершение, выход и явный отказ от неопределённой записи, чтобы закрытие формы не уничтожало журнал операции.

  const completeCreation = async (
    record: ArticleCreationRecord,
    task: ScopedOperation,
  ) => {
    // Сначала перечитывает серверный каталог, затем очищает только соответствующие черновик и операцию, проверяя актуальность аккаунта после ожиданий.

    await readCurrentArticles(task);
    task.assertCurrent();
    if (draft.record?.snapshot.editingId === (record.media?.editingId ?? null))
      await draft.clear();
    task.assertCurrent();
    await journal.clear(record);
    task.assertCurrent();
    setCreation(null);
    setRecoveryMessage(null);
    refreshRelatedContent();
    reset();
  };
  const cancelEditing = async () => {
    // Останавливает ожидание, но не серверный POST; сохраняет ввод и заново читает журнал перед закрытием редактора.

    operation.cancel();
    const task = operation.begin("cancel-article");
    if (!task) return;
    try {
      if (cover.pending) await draft.clear(true);
      else await draft.flush();
      task.assertCurrent();
      // A cancelled POST can still commit. Keep its durable operation.
      const record = await journal.load();
      task.assertCurrent();
      setCreation(record);
      await readCurrentArticles(task);
      task.assertCurrent();
      setRecoveryMessage(null);
      reset();
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        setRecoveryMessage(
          "Не удалось сохранить черновик или обновить список статей. Отмена не подтверждена. Не закрывайте редактор; попробуйте снова.",
        );
    } finally {
      task.finish();
    }
  };
  const discardUnknownEdit = async () => {
    // Явно отбрасывает локальное ожидание существующей статьи только после чтения сервера; не удаляет серверную статью.

    if (!creation?.media?.editingId || creation.media.phase !== "write") return;
    const task = operation.begin("discard-article");
    if (!task) return;
    try {
      await readCurrentArticles(task);
      task.assertCurrent();
      await draft.clear(true);
      task.assertCurrent();
      await journal.clear(creation);
      task.assertCurrent();
      setCreation(null);
      setRecoveryMessage(null);
      reset();
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        setRecoveryMessage(
          "Не удалось обновить список. Локальная копия сохранена.",
        );
    } finally {
      task.finish();
    }
  };
  return { completeCreation, cancelEditing, discardUnknownEdit };
}
