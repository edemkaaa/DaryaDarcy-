/** Восстановление черновика статьи возвращает поля, файлы и базовую ревизию как один согласованный снимок. */
import type { ArticleCreationRecord } from "@/domain/content/article-creation-journal";
import type { ArticleDraftRecord } from "@/domain/content/article-draft-journal";
import type { ContentEditBase } from "@/domain/content/edit-revision";
import type { ArticleBlock } from "@/domain/content/article-blocks";
import type { PrivateArticleFile } from "@/domain/content/private-article-files";
import type { useSessionOperation } from "@/domain/session/use-session-operation";
import type { useArticleDraft } from "./use-article-draft";
import type { useArticleCover } from "./use-article-cover";

type ArticleRestoreForm = {
  uncertainSave: { current: boolean };
  restoreFiles: {
    current: { editingId: number | null; files: PrivateArticleFile[] } | null;
  };
  setCreation: (record: ArticleCreationRecord) => void;
  setEditBase: (base: ContentEditBase | undefined) => void;
  setEditConflict: (status: 409 | 412 | undefined) => void;
  setServerComparison: (detail: Record<string, unknown> | undefined) => void;
  setEditingId: (id: number | null) => void;
  setTitle: (title: string) => void;
  setCoverUrl: (url: string) => void;
  setAccess: (access: "public" | "club") => void;
  setPublished: (published: boolean) => void;
  setBlocks: (blocks: ArticleBlock[]) => void;
  setPreviewing: (previewing: boolean) => void;
  setShowForm: (show: boolean) => void;
  setRecoveryMessage: (message: string | null) => void;
};

type ArticleDraftRestorationDependencies = {
  creation: ArticleCreationRecord | null;
  storageStatus: "loading" | "ready" | "error";
  operation: Pick<ReturnType<typeof useSessionOperation>, "cancel">;
  opening: Pick<ReturnType<typeof useSessionOperation>, "cancel">;
  draft: Pick<ReturnType<typeof useArticleDraft>, "records" | "resume">;
  cover: Pick<
    ReturnType<typeof useArticleCover>,
    "record" | "attach" | "detach"
  >;
  form: ArticleRestoreForm;
};

/** Restore each durable source separately; file URLs are attached by the editor effect. */
export function createArticleDraftRestoration({
  creation,
  storageStatus,
  operation,
  opening,
  draft,
  cover,
  form,
}: ArticleDraftRestorationDependencies) {
  // Собирает три пути восстановления; поля формы и квитанции файлов возвращаются согласованно, без повторной серверной записи.

  const {
    uncertainSave,
    restoreFiles,
    setCreation,
    setEditBase,
    setEditConflict,
    setServerComparison,
    setEditingId,
    setTitle,
    setCoverUrl,
    setAccess,
    setPublished,
    setBlocks,
    setPreviewing,
    setShowForm,
    setRecoveryMessage,
  } = form;
  const restoreCreation = (record: ArticleCreationRecord) => {
    // Отменяет ожидание старой операции и восстанавливает неизменяемый снимок создания; файлы подключит эффект после смены области редактирования.

    operation.cancel();
    cover.detach();
    uncertainSave.current = false;
    setCreation(record);
    setEditBase(record.editBase);
    setEditConflict(record.editConflict);
    setServerComparison(undefined);
    const payload = structuredClone(record.payload);
    setEditingId(record.media?.editingId ?? null);
    setTitle(payload.title);
    setCoverUrl(payload.coverUrl || "");
    setAccess(payload.access);
    setPublished(payload.published);
    setBlocks(payload.sections);
    restoreFiles.current = {
      editingId: record.media?.editingId ?? null,
      files: record.media?.files ?? [],
    };
    // Restore after the editing scope has rendered; the keyed effect below owns the URLs.
    setPreviewing(false);
    setShowForm(true);
  };
  const restoreDraft = (saved: ArticleDraftRecord) => {
    // Не перекрывает незавершённое создание: загружает черновик с исходной ревизией и сохраняет предупреждение о неизвестном исходе записи.

    if (
      creation &&
      (creation.media?.editingId ?? null) === saved.snapshot.editingId
    )
      return;
    if (cover.record?.snapshot.editingId === saved.snapshot.editingId) {
      void restoreCover();
      return;
    }
    const { snapshot, files } = saved;
    setEditBase(snapshot.editBase);
    setEditConflict(snapshot.editConflict);
    setServerComparison(undefined);
    draft.resume();
    opening.cancel();
    operation.cancel();
    cover.detach();
    uncertainSave.current = snapshot.writeUncertain === true;
    setRecoveryMessage(
      snapshot.writeUncertain
        ? "Перед перезагрузкой было отправлено изменение статьи. Проверьте статью в списке; повторная запись автоматически не выполняется."
        : null,
    );
    setEditingId(snapshot.editingId);
    setTitle(snapshot.title);
    setCoverUrl(snapshot.coverUrl || "");
    setAccess(snapshot.access);
    setPublished(snapshot.published);
    setBlocks(structuredClone(snapshot.sections));
    restoreFiles.current = { editingId: snapshot.editingId, files };
    setPreviewing(false);
    setShowForm(true);
  };
  const restoreCover = () => {
    // Восстанавливает операцию обложки только после чтения журнала; перед заменой другого локального текста требуется согласие.

    if (!cover.record || creation || storageStatus !== "ready") return;
    const saved = draft.records.find(
      (record) =>
        record.snapshot.editingId === cover.record!.snapshot.editingId,
    );
    if (saved) {
      const { writeUncertain: _writeUncertain, ...snapshot } = saved.snapshot;
      if (JSON.stringify(snapshot) !== JSON.stringify(cover.record.snapshot)) {
        if (
          !window.confirm(
            "Заменить текущий локальный черновик этой статьи данными сохранённой загрузки баннера?",
          )
        )
          return;
      }
    }
    opening.cancel();
    draft.resume();
    operation.cancel();
    uncertainSave.current = false;
    const { snapshot, files } = cover.record;
    setEditBase(snapshot.editBase);
    setEditConflict(undefined);
    setServerComparison(undefined);
    setEditingId(snapshot.editingId);
    setTitle(snapshot.title);
    setCoverUrl(snapshot.coverUrl || "");
    setAccess(snapshot.access);
    setPublished(snapshot.published);
    setBlocks(structuredClone(snapshot.sections));
    restoreFiles.current = { editingId: snapshot.editingId, files };
    cover.attach(cover.record);
    setRecoveryMessage(null);
    setPreviewing(false);
    setShowForm(true);
  };
  return { restoreCreation, restoreDraft, restoreCover };
}
