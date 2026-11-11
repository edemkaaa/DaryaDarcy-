/** Сверка ревизий отделяет просмотр сервера от решения заменить локальный ввод; подтверждённое сохранение очищает только свою операцию. */
import {
  ArticleDraftJournal,
  type ArticleDraftSnapshot,
} from "@/domain/content/article-draft-journal";
import type {
  ArticleCreationJournal,
  ArticleCreationRecord,
} from "@/domain/content/article-creation-journal";
import {
  editableSnapshot,
  matchesEditableWrite,
  readEditRevision,
  type ContentEditBase,
} from "@/domain/content/edit-revision";
import {
  restoreArticleFileReferences,
  type PrivateArticleFile,
} from "@/domain/content/private-article-files";
import {
  checkOperationAccessError,
  type useSessionOperation,
} from "@/domain/session/use-session-operation";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import type { useArticleDraft } from "./use-article-draft";
import type { useArticleCatalog } from "./use-article-catalog";

type ArticleRevisionDependencies = {
  ownerId: number;
  editingId: number | null;
  creation: ArticleCreationRecord | null;
  form: Pick<
    ArticleDraftSnapshot,
    "title" | "coverUrl" | "access" | "published" | "sections"
  >;
  editBase: ContentEditBase | undefined;
  editConflict: 409 | 412 | undefined;
  serverComparison: Record<string, unknown> | undefined;
  attemptedEdit: { current: Record<string, unknown> | null };
  uncertainSave: { current: boolean };
  operation: Pick<ReturnType<typeof useSessionOperation>, "begin">;
  draft: Pick<
    ReturnType<typeof useArticleDraft>,
    "clear" | "reload" | "saveSnapshot" | "resume"
  >;
  journal: Pick<ArticleCreationJournal, "clear">;
  privateFiles: { files: PrivateArticleFile[] };
  list: Pick<ReturnType<typeof useArticleCatalog>["list"], "restart">;
  readUpdatedArticle: (
    id: number,
    task: ScopedOperation,
  ) => Promise<Record<string, unknown>>;
  completeCreation: (
    record: ArticleCreationRecord,
    task: ScopedOperation,
  ) => Promise<void>;
  refreshRelatedContent: () => void;
  reset: () => void;
  setCreation: (record: ArticleCreationRecord | null) => void;
  setEditBase: (base: ContentEditBase) => void;
  setEditConflict: (status: 409 | 412 | undefined) => void;
  setServerComparison: (detail: Record<string, unknown> | undefined) => void;
  setRecoveryMessage: (message: string) => void;
};

/** Compare without replaying; acceptance durably prepares a later explicit save. */
// Сверка серверного материала и принятие новой базы разделены, чтобы чтение не стирало локальный вариант автоматически.
export function createArticleRevisionActions({
  ownerId,
  editingId,
  creation,
  form,
  editBase,
  editConflict,
  serverComparison,
  attemptedEdit,
  uncertainSave,
  operation,
  draft,
  journal,
  privateFiles,
  list,
  readUpdatedArticle,
  completeCreation,
  refreshRelatedContent,
  reset,
  setCreation,
  setEditBase,
  setEditConflict,
  setServerComparison,
  setRecoveryMessage,
}: ArticleRevisionDependencies) {
  const { title, coverUrl, access, published, sections: blocks } = form;
  const compareArticle = async () => {
    const id = creation?.media?.editingId ?? editingId;
    if (!id) return;
    const task = operation.begin("compare-article");
    if (!task) return;
    try {
      const detail = await readUpdatedArticle(id, task);
      const wanted =
        creation?.media?.phase === "write"
          ? creation.payload
          : (attemptedEdit.current ?? {
              title: title.trim(),
              coverUrl: coverUrl || null,
              access,
              published,
              sections: blocks,
            });
      if (matchesEditableWrite(detail, wanted, "article")) {
        if (creation?.media?.editingId === id)
          await completeCreation(creation, task);
        else {
          await draft.clear();
          task.assertCurrent();
          void list.restart();
          refreshRelatedContent();
          reset();
        }
        return;
      }
      setServerComparison(detail);
      setRecoveryMessage(
        "Серверная версия прочитана. Ваш черновик не изменён; автоматической повторной записи нет.",
      );
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        setRecoveryMessage(
          error instanceof Error
            ? error.message
            : "Не удалось прочитать статью",
        );
    } finally {
      task.finish();
    }
  };
  const acceptArticleRevision = async () => {
    if (!serverComparison || !editingId) return;
    const task = operation.begin("accept-article-revision");
    if (!task) return;
    try {
      const revision = readEditRevision(serverComparison);
      if (!revision)
        throw new Error(
          "Сервер ещё не передаёт версию статьи. Черновик сохранён.",
        );
      if (
        !editConflict &&
        (!editBase?.revision || revision === editBase.revision)
      )
        throw new Error(
          "Предыдущий запрос ещё может выполняться. Повторная запись пока заблокирована.",
        );
      if (
        !window.confirm(
          "Продолжить с вашим вариантом относительно показанной серверной версии? Сохранение потребуется нажать отдельно.",
        )
      )
        return;
      task.assertCurrent();
      // Move an immutable file operation back to an editable, durable draft
      // before clearing it. The selected File objects and receipts are retained.
      const record = creation?.media?.editingId === editingId ? creation : null;
      if (record) {
        const saved = await new ArticleDraftJournal(ownerId).load();
        const current = saved.find(
          (entry) => entry.snapshot.editingId === editingId,
        );
        if (current)
          throw new Error(
            "Есть другой черновик этой статьи. Сначала сохраните его отдельно.",
          );
        const payload = {
          ...record.payload,
          sections: restoreArticleFileReferences(
            record.payload.sections,
            record.media!.files,
          ),
        };
        const base = {
          revision,
          snapshot:
            editBase?.snapshot ?? editableSnapshot(serverComparison, "article"),
        };
        await new ArticleDraftJournal(ownerId).save(
          { ...payload, editingId, editBase: base, writeUncertain: false },
          record.media!.files,
          null,
        );
        task.assertCurrent();
        await draft.reload();
        task.assertCurrent();
        await journal.clear(record);
        task.assertCurrent();
        // Reload the editor's journal rather than inventing a local revision.
        setCreation(null);
        reset();
        return;
      }
      const base = {
        revision,
        snapshot:
          editBase?.snapshot ?? editableSnapshot(serverComparison, "article"),
      };
      await draft.saveSnapshot(
        {
          editingId,
          title,
          coverUrl: coverUrl || null,
          access,
          published,
          sections: blocks,
          editBase: base,
          writeUncertain: false,
        },
        privateFiles.files,
      );
      task.assertCurrent();
      setEditBase(base);
      setEditConflict(undefined);
      uncertainSave.current = false;
      draft.resume();
      setServerComparison(undefined);
      setRecoveryMessage(
        "Версия для следующего сохранения выбрана. Проверьте ваш вариант и нажмите сохранение отдельно.",
      );
    } catch (error) {
      if (task.isCurrent())
        setRecoveryMessage(
          error instanceof Error
            ? error.message
            : "Не удалось сохранить версию черновика",
        );
    } finally {
      task.finish();
    }
  };
  return { compareArticle, acceptArticleRevision };
}
