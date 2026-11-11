"use client";
/** Редактор статей отделяет черновик, создание, загрузку файлов и ревизию серверного материала; неизвестная запись требует проверки. */
import {
  captureEditBase,
  editableSnapshot,
  readEditRevision,
  withExpectedRevision,
  type ContentEditBase,
} from "@/domain/content/edit-revision";
import { EditComparison } from "./edit-comparison";
import { ArticleCatalog } from "./article-catalog";
import { useArticleCatalog } from "./use-article-catalog";
import { recoverArticleCreation } from "./recover-article-creation";
import { createArticleEditorExit } from "./article-editor-exit";
import { createArticleRevisionActions } from "./article-revision-actions";
import { createArticleDraftRestoration } from "./article-draft-restoration";
import classes from "./articles-admin.module.scss";
import {
  ScrollArea,
  Typography,
  Action,
  Background,
  Field,
  Spinner,
} from "@/shared/ui/elements";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { trpc } from "@/shared/api/trpc";
import { requireCursorPage } from "@/shared/api/use-cursor-pages";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import {
  requirePrivateUpload,
  useCapabilities,
  uploadUnavailableMessage,
} from "@/shared/api/capabilities";
import { ArticleContent } from "@/domain/content/article-content";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { checkPrivateUploadAvailability } from "@/shared/media/private-upload-availability";
import { privateUploadRejectionMessage } from "@/shared/api/upload-errors";
import { useConfirmedAction } from "@/domain/session/use-confirmed-action";
import { requireOk } from "@/shared/api/action-result";
import { useArticleFiles } from "./use-article-files";
import { useArticleCover } from "./use-article-cover";
import { useArticleDraft } from "./use-article-draft";
import { useArticleCreationJournal } from "./use-article-creation-journal";
import type { PrivateArticleFile } from "@/domain/content/private-article-files";
import { selectArticleFiles } from "@/domain/content/private-article-files";
import {
  recoverArticleFileUploads,
  sealArticleFileWrite,
} from "@/domain/content/article-file-save";
import {
  emptyBlock,
  normalizeArticleBlocks,
  type ArticleBlock,
} from "@/domain/content/article-blocks";
import {
  BROWN,
  BROWN_LIGHT,
  CREAM,
  ACCENT,
  ADD_BLOCKS,
  BLOCK_LABELS,
} from "./articles-admin.content";
type Access = "public" | "club";
export function ArticlesAdmin() {
  // Перемонтирует редактор статей для нового владельца, исключая перенос File и журнала между аккаунтами.

  const { user } = useAuth();
  return user ? <ArticleEditor key={user.id} ownerId={user.id} /> : null;
}
function ArticleEditor({ ownerId }: { ownerId: number }) {
  // Координирует каталог, редактируемый черновик, неизменяемую операцию файлов и серверную ревизию раздельно.

  const capabilities = useCapabilities();
  const utils = trpc.useUtils();
  const active = useScreenActive();
  const refreshRelatedContent = () => {
    // Статья связана с тизером Клуба, поэтому обновляются оба каталога и агрегаты после подтверждённой записи.

    // Article writes also create, update or remove their club post teasers.
    void utils.admin.postsPage.invalidate();
    void utils.admin.postCounts.invalidate();
    void utils.admin.postCalendar.invalidate();
    void utils.admin.stats.invalidate();
    void utils.admin.articleDetail.invalidate();
    void utils.articles.getById.invalidate();
    void utils.articles.list.invalidate();
    void utils.club.listByCategory.invalidate();
  };
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const catalog = useArticleCatalog(ownerId, active && !showForm);
  const { list } = catalog;
  const opening = useSessionOperation(active && !showForm);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [draftRecoveryError, setDraftRecoveryError] = useState<string | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [access, setAccess] = useState<Access>("club");
  const [previewing, setPreviewing] = useState(false);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([emptyBlock("text")]);
  const {
    journal,
    creation,
    setCreation,
    storageStatus,
    recoveryMessage,
    setRecoveryMessage,
    retryRead: retryCreationJournalRead,
  } = useArticleCreationJournal(ownerId);
  const deletion = useConfirmedAction(active && !showForm);
  const readArticles = async (signal: AbortSignal) => {
    // Сбрасывает окно каталога и проверяет ответ до признания административного действия завершённым.

    const result = await list.restart();
    signal.throwIfAborted();
    if (!result.isSuccess || !result.data)
      throw result.error ?? invalidResponse();
    requireCursorPage(result.data.pages[0]);
  };
  const inspectArticleDeletion = async (
    id: number,
    signal: AbortSignal,
    requireAbsent: boolean,
  ) => {
    // Строгое подтверждение требует null; ручная проверка неизвестного исхода допускает ещё существующую статью без её повторного удаления.

    const detail = await utils.client.admin.articleDetail.query(
      { id },
      { signal },
    );
    signal.throwIfAborted();
    // Confirm deletion only from null. An explicit recovery read may also find
    // the article still present, allowing a deliberate retry of the deletion.
    if (
      detail !== null &&
      (requireAbsent ||
        !detail ||
        detail.id !== id ||
        typeof detail.title !== "string" ||
        !Array.isArray(detail.sections))
    )
      throw invalidResponse();
    await readArticles(signal);
  };
  const remove = {
    isPending: deletion.blocked,
    mutate: (input: { id: number }) =>
      /* Передаёт удаление в механизм подтверждения, не снимая блокировку при потере ответа. */ void deletion.run({
        kind: "delete-article",
        label: "Удалить статью",
        read: async (signal) => {
          // При восстановлении проверяет исходную статью и перечитывает каталог без новой записи.

          await inspectArticleDeletion(input.id, signal, false);
          refreshRelatedContent();
        },
        validate: requireOk,
        perform: async (signal) => {
          // Требует успешную квитанцию удаления и отсутствие статьи при контрольном чтении.

          const result = await utils.client.admin.deleteArticle.mutate(input, {
            signal,
          });
          requireOk(result);
          await inspectArticleDeletion(input.id, signal, true);
          return result;
        },
        commit: refreshRelatedContent,
      }),
  };
  // Файловая операция и редактируемый черновик имеют разных владельцев: неизменяемое отправленное содержимое нельзя заменить новым вводом.
  const operation = useSessionOperation(showForm, editingId);
  const privateFiles = useArticleFiles(showForm, editingId);
  const cover = useArticleCover(ownerId, operation);
  const restorePrivateFiles = privateFiles.restore;
  const fileApi = {
    upload: async (
      input: Parameters<
        typeof utils.client.admin.uploadPrivateContentFile.mutate
      >[0],
      signal: AbortSignal,
    ) => {
      // Проверяет capability приватных файлов перед отправкой исходного payload с ключом.

      await requirePrivateUpload("privateContentUploads", signal);
      return utils.client.admin.uploadPrivateContentFile.mutate(input, {
        signal,
      });
    },
    status: (input: { idempotencyKey: string }, signal: AbortSignal) =>
      /* Читает квитанцию исходной файловой операции для восстановления без слепой загрузки. */ utils.client.admin.privateContentFileStatus.query(input, { signal }),
  };
  const uploading = operation.kind === "photos";
  const [published, setPublished] = useState(true);
  const uncertainSave = useRef(false);
  const [editBase, setEditBase] = useState<ContentEditBase>();
  const [editConflict, setEditConflict] = useState<409 | 412>();
  const [serverComparison, setServerComparison] =
    useState<Record<string, unknown>>();
  const attemptedEdit = useRef<Record<string, unknown> | null>(null);
  const draft = useArticleDraft(
    ownerId,
    showForm &&
      !(creation && (creation.media?.editingId ?? null) === editingId) &&
      !cover.pending,
    {
      editingId,
      title,
      coverUrl: coverUrl || null,
      access,
      published,
      sections: blocks,
      writeUncertain: uncertainSave.current,
      editBase,
      editConflict,
    },
    privateFiles.files,
  );
  const recoverLocalDrafts = async (key?: string) => {
    // Перечитывает локальные черновики либо архивирует повреждённый снимок с файлами после явного согласия, не меняя статьи сервера.

    if (
      key &&
      !window.confirm(
        "Сохранить повреждённый черновик и его файлы в резервной копии на этом устройстве и освободить редактор? Автоматически открыть эту копию нельзя. Статьи на сервере не изменятся.",
      )
    )
      return;
    const task = opening.begin("recover-local-article-draft");
    if (!task) return;
    setDraftRecoveryError(null);
    try {
      if (key) await draft.archiveDamaged(key);
      else await draft.reload();
      task.assertCurrent();
    } catch (cause) {
      if (task.isCurrent())
        setDraftRecoveryError(
          cause instanceof Error
            ? cause.message
            : "Не удалось восстановить доступ к черновикам.",
        );
    } finally {
      task.finish();
    }
  };
  const restoreFiles = useRef<{
    editingId: number | null;
    files: PrivateArticleFile[];
  } | null>(null);
  const notify = (message: string) => {
    // Показывает ошибку, сохраняя рабочую форму и файлы для повторной проверки.

    window.alert(message);
  };
  const reset = () => {
    // Очищает область формы, превью и признаки сравнения, но durable операции остаются у соответствующих журналов.

    operation.cancel();
    cover.detach();
    privateFiles.reset();
    restoreFiles.current = null;
    uncertainSave.current = false;
    setEditBase(undefined);
    setEditConflict(undefined);
    setServerComparison(undefined);
    attemptedEdit.current = null;
    setPublished(true);
    setEditingId(null);
    setShowForm(false);
    setTitle("");
    setCoverUrl("");
    setAccess("club");
    setPreviewing(false);
    setBlocks([emptyBlock("text")]);
  };
  const { restoreCreation, restoreDraft, restoreCover } =
    createArticleDraftRestoration({
      creation,
      storageStatus,
      operation,
      opening,
      draft,
      cover,
      form: {
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
      },
    });
  useEffect(() => {
    // После смены editingId подключает File из восстановленного снимка к новой области, не используя адреса прежней формы.

    const record = restoreFiles.current;
    if (showForm && record && record.editingId === editingId) {
      restoreFiles.current = null;
      restorePrivateFiles(record.files);
    }
  }, [creation, showForm, editingId, restorePrivateFiles]);
  const readCurrentArticles = async (task: ScopedOperation) => {
    // Привязывает обновление каталога к текущей отменяемой операции.

    await readArticles(task.signal);
    task.assertCurrent();
  };
  const readUpdatedArticle = async (id: number, task: ScopedOperation) => {
    // Требует существующую статью с тем же ID и проверяет серверную ревизию до её использования.

    const detail = await utils.client.admin.articleDetail.query(
      { id },
      { signal: task.signal },
    );
    task.assertCurrent();
    if (!detail || detail.id !== id) throw invalidResponse();
    readEditRevision(detail);
    return detail;
  };
  const { completeCreation, cancelEditing, discardUnknownEdit } =
    createArticleEditorExit({
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
    });
  const { compareArticle, acceptArticleRevision } = createArticleRevisionActions({
    ownerId,
    editingId,
    creation,
    form: { title, coverUrl, access, published, sections: blocks },
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
  });
  const recoverCreation = (replay: boolean) =>
    /* Передаёт восстановление прежнего payload и ключа общему координатору статьи и файлов. */ recoverArticleCreation(creation, replay, {
      operation,
      journal,
      fileApi,
      api: utils.client.admin,
      readUpdatedArticle,
      completeCreation,
      setCreation,
      setEditConflict,
      setServerComparison,
      setRecoveryMessage,
      notify,
    });
  const pickImages = async (
    multiple: boolean,
    commit: (urls: string[]) => void,
  ) => {
    // Принимает подготовленные локальные ссылки только пока операция и владелец формы актуальны.

    const task = operation.begin("photos");
    if (!task) return;
    try {
      const selected = await privateFiles.photos(multiple, task);
      task.assertCurrent();
      if (selected.length) commit(selected);
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        notify(
          error instanceof Error ? error.message : "Не удалось загрузить файл",
        );
    } finally {
      task.finish();
    }
  };
  const pickDocument = async (index: number) => {
    // Прикрепляет выбранный документ к указанному блоку после проверки области; не сохраняет статью отдельно.

    const task = operation.begin("photos");
    if (!task) return;
    try {
      const file = await privateFiles.document(task);
      task.assertCurrent();
      if (file) updateBlock(index, file);
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        notify(
          error instanceof Error ? error.message : "Не удалось выбрать файл",
        );
    } finally {
      task.finish();
    }
  };
  const insertBlock = (index: number, type: ArticleBlock["type"]) => {
    // Вставляет новый пустой блок после выбранного, сохраняя порядок остальных блоков.

    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, emptyBlock(type));
      return next;
    });
  };
  const updateBlock = (index: number, patch: Partial<ArticleBlock>) => {
    // Меняет один блок и освобождает превью, которые больше нигде в статье не используются.

    const next = blocks.map((block, i) =>
      i === index ? { ...block, ...patch } : block,
    );
    privateFiles.prune(next);
    setBlocks(next);
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    // Меняет местами соседние блоки лишь в допустимых границах, не изменяя содержимое файлов.

    setBlocks((prev) => {
      const to = index + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };
  // Выбор ветки зависит от наличия серверного ID и локальных файлов; каждая ветка оставляет своё доказательство для восстановления.
  const save = async () => {
    // Выбирает путь по наличию ID и новых File; перед сетью сохраняет неизменяемую операцию или маркер неизвестного update.

    if (cover.pending) return;
    if (!title.trim()) {
      notify("Напишите название статьи");
      return;
    }
    if (title.trim().length > 255) {
      notify("Название статьи должно быть не длиннее 255 символов");
      return;
    }
    if (!editingId && (creation || storageStatus !== "ready")) return;
    if (editingId && creation?.media?.editingId === editingId) return;
    if (uncertainSave.current) {
      notify(
        "Результат сохранения не подтверждён. Проверьте статью в списке перед новой попыткой.",
      );
      return;
    }
    if (editConflict) {
      notify("Сначала сравните ваш черновик с серверной версией статьи.");
      return;
    }
    const task = operation.begin("save");
    if (!task) return;
    let storedCreation = false;
    let uploadingFiles = false;
    let writeStarted = false;
    try {
      await draft.flush();
      task.assertCurrent();
      const payload = {
        title: title.trim(),
        coverUrl: coverUrl || null,
        access,
        published,
        sections: blocks,
      };
      // Не отправляем все когда-либо выбранные файлы: в операцию входят только ссылки актуальных блоков.
      const selected = selectArticleFiles(blocks, privateFiles.files);
      // Новые File сначала получают durable ключи и квитанции; статья записывается только с подтверждёнными ссылками.
      if (selected.length) {
        await checkPrivateUploadAvailability(fileApi.status, task);
        const prepared = await journal.prepare(
          payload,
          {
            editingId,
            files: selected,
          },
          editBase,
        );
        task.assertCurrent();
        storedCreation = true;
        setCreation(prepared.record);
        if (prepared.restored) {
          restoreCreation(prepared.record);
          return;
        }
        // The immutable operation now owns all fields/files; free the editable draft.
        await draft.clear();
        task.assertCurrent();
        uploadingFiles = true;
        let record = await recoverArticleFileUploads(
          prepared.record,
          journal,
          fileApi,
          task,
          setCreation,
        );
        uploadingFiles = false;
        record = await sealArticleFileWrite(record, journal, task);
        setCreation(record);
        if (editingId) {
          attemptedEdit.current = record.payload;
          requireOk(
            await utils.client.admin.updateArticle.mutate(
              withExpectedRevision(
                { id: editingId, ...record.payload },
                record.editBase?.revision,
              ),
              { signal: task.signal },
            ),
          );
          await readUpdatedArticle(editingId, task);
        } else {
          const id = await utils.client.admin.createArticle.mutate(
            { ...record.payload, idempotencyKey: record.idempotencyKey },
            { signal: task.signal },
          );
          if (!Number.isSafeInteger(id) || id <= 0) throw invalidResponse();
        }
        task.assertCurrent();
        await completeCreation(record, task);
        return;
      }
      if (!editingId) {
        const prepared = await journal.prepare(payload);
        task.assertCurrent();
        storedCreation = true;
        setCreation(prepared.record);
        if (prepared.restored) {
          restoreCreation(prepared.record);
          setRecoveryMessage(
            "Восстановлена предыдущая операция создания. Сначала проверьте её результат.",
          );
          return;
        }
        await draft.clear();
        task.assertCurrent();
        const id = await utils.client.admin.createArticle.mutate(
          {
            ...prepared.record.payload,
            idempotencyKey: prepared.record.idempotencyKey,
          },
          { signal: task.signal },
        );
        if (!Number.isSafeInteger(id) || id <= 0) throw invalidResponse();
        task.assertCurrent();
        await completeCreation(prepared.record, task);
        return;
      }
      // Update без новых файлов тоже оставляет durable маркер до отправки: после потери ответа доступна сверка, а не слепой повтор.
      await draft.markWriteStarted();
      task.assertCurrent();
      writeStarted = true;
      attemptedEdit.current = payload;
      const result = await utils.client.admin.updateArticle.mutate(
        withExpectedRevision({ id: editingId, ...payload }, editBase?.revision),
        { signal: task.signal },
      );
      requireOk(result);
      task.assertCurrent();
      await readUpdatedArticle(editingId, task);
      await draft.clear();
      task.assertCurrent();
      void list.restart();
      refreshRelatedContent();
      reset();
    } catch (error) {
      checkOperationAccessError(error);
      const status = getHttpStatus(error);
      if (task.isCurrent() && editingId && (status === 409 || status === 412)) {
        setEditConflict(status);
        uncertainSave.current = true;
        try {
          const record = await journal.load();
          task.assertCurrent();
          if (
            record?.media?.editingId === editingId &&
            record.media.phase === "write"
          ) {
            const next = await journal.recordConflict(record, status);
            task.assertCurrent();
            setCreation(next);
          } else await draft.markWriteStarted(status);
        } catch {
          /* The original write marker remains durable and blocks replay. */
        }
        setRecoveryMessage(
          "Статья изменилась или не указана версия. Ваш ввод и файлы сохранены. Сравните с серверной записью.",
        );
      }
      const uploadRejection = uploadingFiles
        ? privateUploadRejectionMessage(error)
        : null;
      const uploadMessage = uploadRejection
        ? `${uploadRejection} Исходные файлы сохранены на этом устройстве. Проверьте загрузку позже.`
        : null;
      if (task.isCurrent() && editingId) {
        uncertainSave.current =
          uncertainSave.current || (writeStarted && (!status || status >= 500));
        if (!uncertainSave.current) draft.resume();
      }
      if (task.isCurrent() && (uploadMessage || !editingId))
        setRecoveryMessage(
          uploadMessage ??
            (!storedCreation
              ? error instanceof Error
                ? error.message
                : "Не удалось сохранить операцию на устройстве. Запрос не отправлен."
              : status === 409
                ? "Конфликт данных операции. Проверьте сохранение; ключ не изменён."
                : "Результат сохранения не подтверждён. Проверьте сохранение статьи; исходная операция сохранена на устройстве."),
        );
      if (task.isCurrent())
        notify(
          uploadMessage ??
            ((!editingId && storedCreation) || uncertainSave.current
              ? "Результат сохранения не подтверждён. Проверьте статью в списке перед новой попыткой."
              : error instanceof Error
                ? error.message
                : "Не удалось сохранить статью"),
        );
    } finally {
      task.finish();
    }
  };
  const startEdit = async (id: number) => {
    // Сначала предлагает существующие локальные черновики и загрузки; иначе строго проверяет полную серверную статью и захватывает базовую ревизию.

    if (!draft.loaded || draft.isDamaged(id)) return;
    const saved = draft.records.find(
      (record) => record.snapshot.editingId === id,
    );
    if (saved) {
      restoreDraft(saved);
      return;
    }
    if (cover.record?.snapshot.editingId === id) {
      void restoreCover();
      return;
    }
    const task = opening.begin("article-detail");
    if (!task) return;
    setOpeningId(id);
    setOpeningError(null);
    try {
      const item = await utils.client.admin.articleDetail.query(
        { id },
        { signal: task.signal },
      );
      task.assertCurrent();
      if (item === null) {
        setOpeningError("Статья не найдена. Обновите список статей.");
        return;
      }
      if (
        !item ||
        item.id !== id ||
        typeof item.title !== "string" ||
        typeof item.published !== "boolean" ||
        !["public", "club"].includes(item.access) ||
        !(item.coverUrl === null || typeof item.coverUrl === "string") ||
        !Array.isArray(item.sections) ||
        !item.sections.every(
          (block) =>
            block &&
            ["heading", "text", "photo", "png", "link", "carousel"].includes(
              block.type,
            ) &&
            [
              block.text,
              block.url,
              block.label,
              "caption" in block ? block.caption : undefined,
            ].every(
              (value) => value === undefined || typeof value === "string",
            ) &&
            (block.urls === undefined ||
              (Array.isArray(block.urls) &&
                block.urls.every((value) => typeof value === "string"))),
        )
      )
        throw invalidResponse();
      operation.cancel();
      draft.resume();
      cover.detach();
      uncertainSave.current = false;
      // Полная серверная запись и её ревизия становятся единой базой редактирования; данные короткой карточки для этого недостаточны.
      setPublished(item.published);
      setEditBase(captureEditBase(item, editableSnapshot(item, "article")));
      setEditConflict(undefined);
      setServerComparison(undefined);
      setEditingId(item.id);
      setTitle(item.title);
      setCoverUrl(item.coverUrl || "");
      setAccess(item.access);
      setPreviewing(false);
      setBlocks(normalizeArticleBlocks(item.sections));
      privateFiles.reset();
      setShowForm(true);
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) setOpeningError(getRequestErrorMessage(error));
    } finally {
      task.finish();
    }
  };
  const confirmDelete = (id: number) => {
    // Отдельное согласие требуется перед удалением статьи; сетевое подтверждение выполняет механизм deletion.

    const run = () => /* Передаёт ID выбранной статьи в подтверждаемую команду удаления. */ remove.mutate({ id });
    {
      if (window.confirm("Удалить статью?")) run();
      return;
    }
  };
  const damagedDraft =
    !showForm && !draft.readError ? draft.damaged[0] : undefined;
  const draftIssue = draft.error || draft.readError || draftRecoveryError;
  const noticeMessage =
    draft.error ||
    (draft.readError
      ? "Не удалось прочитать черновики на этом устройстве."
      : null) ||
    draftRecoveryError ||
    recoveryMessage ||
    cover.message ||
    deletion.error ||
    (damagedDraft ? "Не удалось открыть локальный черновик статьи." : null);
  useBackgroundNotice({
    when: Boolean(noticeMessage),
    message: noticeMessage ?? "",
    priority: 1,
    busy: opening.busy || operation.busy || remove.isPending,
    onRetry:
      draftIssue || damagedDraft
        ? async () => {
            if (showForm) {
              if (draft.error) await draft.flush().catch(() => {});
              else await draft.reload().catch(() => {});
            } else await recoverLocalDrafts();
          }
        : undefined,
    actions: damagedDraft
      ? [
          {
            id: "recover-article-draft",
            label: "Восстановить редактор",
            onClick: () => /* Архивирует только выбранный повреждённый локальный черновик, сохраняя его резервную копию на устройстве. */ recoverLocalDrafts(damagedDraft.key),
          },
        ]
      : undefined,
  });
  if (showForm) {
    const busy = operation.busy;
    const pendingCreation =
      creation !== null && (creation.media?.editingId ?? null) === editingId;
    return (
      <ScrollArea contentClassName={classes.form}>
        {editingId &&
        (editConflict ||
          uncertainSave.current ||
          creation?.media?.phase === "write") ? (
          <EditComparison
            current={
              creation?.media?.editingId === editingId
                ? creation.payload
                : { title, coverUrl, access, published, sections: blocks }
            }
            server={
              serverComparison
                ? editableSnapshot(serverComparison, "article")
                : undefined
            }
            busy={busy}
            onRead={() => void compareArticle()}
            onAccept={
              serverComparison ? () => void acceptArticleRevision() : undefined
            }
          />
        ) : null}
        {!draft.error && (
          <StatusNotice>
            {draft.saving
              ? "Сохраняем черновик на устройстве…"
              : "Черновик статьи сохраняется на этом устройстве."}
          </StatusNotice>
        )}
        {pendingCreation ? (
          <div>
            <Typography className={classes.hint}>
              Исходные данные создания сохранены на этом устройстве. Сначала
              проверьте результат; повтор использует ту же операцию.
            </Typography>
            <Action
              disabled={busy}
              onClick={() => void recoverCreation(false)}
              className={classes.btnGhost}
            >
              Проверить сохранение
            </Action>
            <Action
              disabled={
                busy ||
                Boolean(
                  creation?.media?.editingId &&
                  creation.media.phase === "write",
                )
              }
              onClick={() => void recoverCreation(true)}
              className={classes.btnGhost}
            >
              Повторить сохранение
            </Action>
            {creation?.media?.editingId && creation.media.phase === "write" ? (
              <Action
                disabled={busy}
                onClick={() => void discardUnknownEdit()}
                className={classes.btnGhost}
              >
                Проверил список — удалить локальную копию
              </Action>
            ) : null}
          </div>
        ) : null}
        {cover.pending && cover.message ? (
          <div>
            <Action
              disabled={busy}
              onClick={() => void cover.recover(false, setCoverUrl)}
              className={classes.btnGhost}
            >
              Проверить загрузку баннера
            </Action>
            {cover.canRetry ? (
              <Action
                disabled={busy}
                onClick={() => void cover.recover(true, setCoverUrl)}
                className={classes.btnGhost}
              >
                Повторить загрузку баннера
              </Action>
            ) : null}
            <Action
              disabled={busy}
              onClick={() => void cover.discard()}
              className={classes.btnGhost}
            >
              Отменить загрузку баннера
            </Action>
          </div>
        ) : null}
        <div
          inert={busy || pendingCreation || cover.pending}
          style={{ display: "contents" }}
        >
          <Typography className={classes.formTitle}>
            {editingId ? "Редактировать статью" : "Новая статья"}
          </Typography>
          <Action
            onClick={() => setPublished((value) => !value)}
            className={classes.btnGhost}
          >
            <Typography className={classes.btnGhostText}>
              {published ? "Статус: опубликована" : "Статус: черновик"}
            </Typography>
          </Action>
          <Typography className={classes.label}>Куда уйдёт статья</Typography>
          <div className={["ui-stack ", classes.row].filter(Boolean).join(" ")}>
            <Action
              onClick={() => {
                setAccess("club");
                setPreviewing(false);
              }}
              className={[
                classes.chipOn,
                access === "club" && !previewing
                  ? classes.backgroundColorState
                  : classes.backgroundColorState2,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography
                className={[
                  classes.chipTextOn,
                  access === "club" && !previewing
                    ? classes.colorState
                    : classes.colorState2,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Клуб / эксклюзив
              </Typography>
            </Action>
            <Action
              onClick={() => {
                setAccess("public");
                setPreviewing(false);
              }}
              className={[
                classes.chipOn,
                access === "public" && !previewing
                  ? classes.backgroundColorState3
                  : classes.backgroundColorState4,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="lock"
                size={13}
                color={access === "public" && !previewing ? CREAM : BROWN}
              />
              <Typography
                className={[
                  classes.chipTextOn,
                  access === "public" && !previewing
                    ? classes.colorState3
                    : classes.colorState4,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Клуб + библиотека
              </Typography>
            </Action>
            <Action
              onClick={() => setPreviewing(true)}
              className={[
                classes.chipOn,
                previewing
                  ? classes.backgroundColorState5
                  : classes.backgroundColorState6,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography
                className={[
                  classes.chipTextOn,
                  previewing ? classes.colorState5 : classes.colorState6,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Предпросмотр
              </Typography>
            </Action>
          </div>
          <Typography className={classes.hint}>
            {access === "public"
              ? "Появится в Эксклюзиве клуба и в библиотеке. В библиотеке статью можно читать без подписки. В общую ленту статьи не попадают."
              : "Появится в Эксклюзиве клуба и в библиотеке. Читать статью смогут только участники клуба. В общую ленту статьи не попадают."}
          </Typography>

          {previewing ? (
            <Background
              source={{
                uri: "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp",
              }}
              className={classes.previewPaper}
              imageClassName={classes.backgroundimage}
            >
              <ArticleContent
                title={title}
                coverUrl={coverUrl || null}
                blocks={privateFiles.previewBlocks(blocks)}
              />
            </Background>
          ) : (
            <>
              <Typography className={classes.label}>
                Баннер (узкий, широкий)
              </Typography>
              <Action
                onClick={() =>
                  void cover.start(
                    {
                      editingId,
                      title,
                      coverUrl: coverUrl || null,
                      access,
                      published,
                      sections: blocks,
                      editBase,
                    },
                    privateFiles.files,
                    setCoverUrl,
                  )
                }
                disabled={cover.storageStatus !== "ready" || !!cover.record}
                className={classes.btn}
              >
                <MaterialIcons
                  name="photo-size-select-actual"
                  size={16}
                  color={CREAM}
                />
                <Typography className={classes.btnText}>
                  {uploading
                    ? "Загрузка..."
                    : coverUrl
                      ? "Сменить баннер"
                      : "Выбрать баннер"}
                </Typography>
              </Action>
              {coverUrl ? (
                <Picture
                  source={{ uri: coverUrl }}
                  contentFit="cover"
                  className={classes.banner}
                />
              ) : null}

              <Typography className={classes.label}>Заголовок</Typography>
              <Field
                value={title}
                onValueChange={setTitle}
                placeholder="Что посмотреть осенью..."
                placeholderColor="#A89880"
                multiline
                className={classes.titleInput}
              />

              {blocks.map((block, index) => (
                <div
                  key={`${block.type}-${index}`}
                  className={["ui-stack ", classes.blockCard]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={["ui-stack ", classes.blockHead]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.blockLabel}>
                      {BLOCK_LABELS[block.type]}
                    </Typography>
                    <div
                      className={["ui-stack ", classes.row]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Action
                        aria-label={`Переместить блок ${index + 1} вверх`}
                        onClick={() => moveBlock(index, -1)}
                        hitArea={8}
                      >
                        <MaterialIcons
                          name="keyboard-arrow-up"
                          size={20}
                          color={BROWN_LIGHT}
                        />
                      </Action>
                      <Action
                        aria-label={`Переместить блок ${index + 1} вниз`}
                        onClick={() => moveBlock(index, 1)}
                        hitArea={8}
                      >
                        <MaterialIcons
                          name="keyboard-arrow-down"
                          size={20}
                          color={BROWN_LIGHT}
                        />
                      </Action>
                      {blocks.length > 1 ? (
                        <Action
                          aria-label={`Удалить блок ${index + 1}`}
                          onClick={() => {
                            const next = blocks.filter((_, i) => i !== index);
                            privateFiles.prune(next);
                            setBlocks(next);
                          }}
                          hitArea={8}
                        >
                          <MaterialIcons
                            name="close"
                            size={18}
                            color="#A85C5C"
                          />
                        </Action>
                      ) : null}
                    </div>
                  </div>

                  {block.type === "heading" || block.type === "text" ? (
                    <Field
                      style={{
                        ...((block.type === "heading" ? true : false)
                          ? {
                              fontSize:
                                block.type === "heading" ? 18 : undefined,
                            }
                          : {}),
                        ...((block.type === "heading" ? true : false)
                          ? {
                              fontFamily:
                                block.type === "heading"
                                  ? "EBGaramond-Bold"
                                  : undefined,
                            }
                          : {}),
                        ...((block.type === "heading" ? true : false)
                          ? {
                              textAlign:
                                block.type === "heading" ? "center" : undefined,
                            }
                          : {}),
                        ...((block.type === "heading" ? false : true)
                          ? {
                              minHeight:
                                block.type === "heading" ? undefined : 120,
                            }
                          : {}),
                      }}
                      value={block.text || ""}
                      onValueChange={(value) =>
                        updateBlock(index, { text: value })
                      }
                      placeholder={
                        block.type === "heading"
                          ? "• Уютные 90-е •"
                          : "Абзац. Пустая строка — новый абзац. Ссылка: [название](https://...)"
                      }
                      placeholderColor="#A89880"
                      multiline
                      className={
                        block.type === "heading"
                          ? classes.appearanceState
                          : classes.appearanceState2
                      }
                    />
                  ) : null}

                  {block.type === "link" ? (
                    <>
                      <Action
                        onClick={() => void pickDocument(index)}
                        disabled={
                          operation.busy || !capabilities.privateContentUploads
                        }
                        title={
                          !capabilities.privateContentUploads
                            ? uploadUnavailableMessage
                            : undefined
                        }
                        className={classes.btnSecondary}
                      >
                        <Typography className={classes.btnSecondaryText}>
                          Загрузить файл
                        </Typography>
                      </Action>
                      <Field
                        value={block.label || ""}
                        onValueChange={(value) =>
                          updateBlock(index, { label: value })
                        }
                        placeholder="Текст ссылки, например Смотреть трейлер"
                        placeholderColor="#A89880"
                        className={classes.input}
                      />
                      <Field
                        value={
                          block.url?.startsWith("local-content:")
                            ? ""
                            : block.url || ""
                        }
                        onValueChange={(value) =>
                          updateBlock(index, { url: value })
                        }
                        placeholder="https://"
                        placeholderColor="#A89880"
                        autoCapitalize="off"
                        className={classes.input}
                      />
                    </>
                  ) : null}

                  {block.type === "carousel" ? (
                    <>
                      <Action
                        disabled={
                          operation.busy || !capabilities.privateContentUploads
                        }
                        title={
                          !capabilities.privateContentUploads
                            ? uploadUnavailableMessage
                            : undefined
                        }
                        onClick={() =>
                          pickImages(true, (urls) =>
                            updateBlock(index, {
                              urls: [...(block.urls || []), ...urls],
                            }),
                          )
                        }
                        className={classes.btnSecondary}
                      >
                        <MaterialIcons
                          name="view-carousel"
                          size={16}
                          color={ACCENT}
                        />
                        <Typography className={classes.btnSecondaryText}>
                          {uploading
                            ? "Загрузка..."
                            : block.urls?.length
                              ? "Добавить кадры"
                              : "Выбрать фото для карусели"}
                        </Typography>
                      </Action>
                      {block.urls?.length ? (
                        <div
                          className={["ui-stack ", classes.carouselPreview]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {block.urls.map((url, photoIndex) => (
                            <Action
                              aria-label={`Удалить фото ${photoIndex + 1} из блока ${index + 1}`}
                              key={`${url}-${photoIndex}`}
                              onClick={() =>
                                updateBlock(index, {
                                  urls: (block.urls || []).filter(
                                    (_, i) => i !== photoIndex,
                                  ),
                                })
                              }
                            >
                              <Picture
                                source={{ uri: privateFiles.preview(url) }}
                                contentFit="cover"
                                className={classes.carouselThumb}
                              />
                            </Action>
                          ))}
                        </div>
                      ) : null}
                      <Typography className={classes.hint}>
                        Нажмите на миниатюру, чтобы убрать кадр. Скруглённая
                        карусель появится в тексте статьи.
                      </Typography>
                      <Field
                        value={block.caption || ""}
                        onValueChange={(value) =>
                          updateBlock(index, { caption: value })
                        }
                        placeholder="Подпись под каруселью: источник..."
                        placeholderColor="#A89880"
                        className={classes.input}
                      />
                    </>
                  ) : null}

                  {block.type === "photo" || block.type === "png" ? (
                    <>
                      <Action
                        disabled={
                          operation.busy || !capabilities.privateContentUploads
                        }
                        title={
                          !capabilities.privateContentUploads
                            ? uploadUnavailableMessage
                            : undefined
                        }
                        onClick={() =>
                          pickImages(true, (urls) => {
                            const next = [...blocks];
                            next[index] = {
                              type: block.type,
                              url: urls[0],
                              caption: block.caption || "",
                            };
                            const extra = urls.slice(1).map(
                              (url) =>
                                ({
                                  type: block.type,
                                  url,
                                  caption: "",
                                }) as ArticleBlock,
                            );
                            next.splice(index + 1, 0, ...extra);
                            privateFiles.prune(next);
                            setBlocks(next);
                          })
                        }
                        className={classes.btnSecondary}
                      >
                        <MaterialIcons
                          name={block.type === "png" ? "image" : "photo"}
                          size={16}
                          color={ACCENT}
                        />
                        <Typography className={classes.btnSecondaryText}>
                          {uploading
                            ? "Загрузка..."
                            : block.url
                              ? "Заменить"
                              : block.type === "png"
                                ? "Выбрать PNG без фона"
                                : "Выбрать фото"}
                        </Typography>
                      </Action>
                      {block.url ? (
                        <Picture
                          source={{ uri: privateFiles.preview(block.url) }}
                          style={{
                            ...((block.type === "png" ? true : false)
                              ? {
                                  height:
                                    block.type === "png" ? 160 : undefined,
                                }
                              : {}),
                            ...((block.type === "png" ? false : true)
                              ? {
                                  aspectRatio:
                                    block.type === "png" ? undefined : 1.6,
                                }
                              : {}),
                            ...((block.type === "png" ? false : true)
                              ? {
                                  borderRadius:
                                    block.type === "png" ? undefined : 8,
                                }
                              : {}),
                          }}
                          contentFit={
                            block.type === "png" ? "contain" : "cover"
                          }
                          className={
                            block.type === "png"
                              ? classes.appearanceState3
                              : classes.appearanceState4
                          }
                        />
                      ) : null}
                      <Field
                        value={block.caption || ""}
                        onValueChange={(value) =>
                          updateBlock(index, { caption: value })
                        }
                        placeholder="Подпись под фото: источник, автор..."
                        placeholderColor="#A89880"
                        className={classes.input}
                      />
                    </>
                  ) : null}

                  <div
                    className={["ui-stack ", classes.addRow]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {ADD_BLOCKS.map((item) => (
                      <Action
                        key={item.type}
                        onClick={() => insertBlock(index, item.type)}
                        className={classes.addChip}
                      >
                        <MaterialIcons
                          name={item.icon}
                          size={14}
                          color={ACCENT}
                        />
                        <Typography className={classes.addChipText}>
                          {item.label}
                        </Typography>
                      </Action>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div
          className={["ui-stack ", classes.formActions]
            .filter(Boolean)
            .join(" ")}
        >
          <Action
            disabled={remove.isPending}
            onClick={() => void cancelEditing()}
            className={classes.btnGhost}
          >
            <Typography className={classes.btnGhostText}>Отмена</Typography>
          </Action>
          <Action
            onClick={save}
            disabled={
              busy ||
              pendingCreation ||
              cover.pending ||
              (!editingId && storageStatus !== "ready")
            }
            aria-busy={busy}
            aria-label={
              editingId
                ? "Сохранить"
                : published
                  ? "Опубликовать"
                  : "Сохранить черновик"
            }
            className={classes.btn}
          >
            {busy ? (
              <Spinner color={CREAM} />
            ) : (
              <Typography className={classes.btnText}>
                {editingId
                  ? "Сохранить"
                  : published
                    ? "Опубликовать"
                    : "Сохранить черновик"}
              </Typography>
            )}
          </Action>
        </div>
      </ScrollArea>
    );
  }
  return (
    <ArticleCatalog
      catalog={catalog}
      openingNotice={
        <QueryRetryState
          isLoading={opening.busy}
          isError={Boolean(openingError)}
          onRetry={() => {
            if (openingId !== null) void startEdit(openingId);
          }}
          message={openingError ?? "Не удалось загрузить статью"}
        />
      }
      editDisabled={(id) =>
        remove.isPending || opening.busy || !draft.loaded || draft.isDamaged(id)
      }
      deleteDisabled={remove.isPending || opening.busy}
      onEdit={(id) => void startEdit(id)}
      onDelete={confirmDelete}
    >
      {draft.records.map(
        (saved) =>
          (!creation ||
            (creation.media?.editingId ?? null) !==
              saved.snapshot.editingId) && (
            <StatusNotice
              key={saved.snapshot.editingId ?? "new"}
              actions={
                <>
                  <StatusNoticeAction
                    disabled={opening.busy || remove.isPending}
                    onClick={() => restoreDraft(saved)}
                  >
                    Продолжить черновик статьи
                  </StatusNoticeAction>
                  <StatusNoticeAction
                    disabled={opening.busy || remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Удалить локальный черновик статьи вместе с выбранными файлами?",
                        )
                      )
                        void draft
                          .clear(true, saved.snapshot.editingId)
                          .catch(() => {});
                    }}
                  >
                    Удалить черновик с устройства
                  </StatusNoticeAction>
                </>
              }
            >
              На устройстве сохранён черновик:{" "}
              {saved.snapshot.title || "Без названия"}.
            </StatusNotice>
          ),
      )}
      {cover.storageStatus === "error" ? (
        <StatusNoticeAction onClick={cover.retryRead}>
          Повторить чтение загрузки баннера
        </StatusNoticeAction>
      ) : null}
      {cover.record ? (
        <StatusNoticeAction
          disabled={
            remove.isPending ||
            opening.busy ||
            !!creation ||
            storageStatus !== "ready"
          }
          onClick={() => void restoreCover()}
        >
          Восстановить загрузку баннера
        </StatusNoticeAction>
      ) : null}
      {storageStatus === "error" ? (
        <StatusNoticeAction
          onClick={retryCreationJournalRead}
        >
          Повторить чтение операции
        </StatusNoticeAction>
      ) : null}
      {cover.record && creation ? (
        <Typography className={classes.hint}>
          Перед восстановлением баннера проверьте незавершённое сохранение
          статьи.
        </Typography>
      ) : null}
      {creation ? (
        <Typography className={classes.hint}>
          Есть незавершённая операция создания статьи. Восстановите её перед
          новой статьёй.
        </Typography>
      ) : null}
      {deletion.unknown && !deletion.operation.busy ? (
        <StatusNoticeAction onClick={() => void deletion.check()}>
          Обновить список
        </StatusNoticeAction>
      ) : null}
      <Action
        disabled={
          remove.isPending ||
          opening.busy ||
          storageStatus !== "ready" ||
          !draft.loaded ||
          (!creation && draft.isDamaged(null))
        }
        onClick={() => {
          draft.resume();
          if (creation) restoreCreation(creation);
          else {
            const saved = draft.records.find(
              (record) => record.snapshot.editingId === null,
            );
            if (saved) restoreDraft(saved);
            else setShowForm(true);
          }
        }}
        className={classes.btn}
      >
        <MaterialIcons name="menu-book" size={16} color={CREAM} />
        <Typography className={classes.btnText}>
          {creation
            ? creation.media?.editingId
              ? "Восстановить изменение статьи"
              : "Восстановить создание статьи"
            : "Написать статью"}
        </Typography>
      </Action>
      <Typography className={classes.hint}>
        Статьи появляются в Эксклюзиве клуба и в библиотеке. Чтение — по
        подписке или без подписки. В общую ленту статьи не попадают.
      </Typography>
    </ArticleCatalog>
  );
}
