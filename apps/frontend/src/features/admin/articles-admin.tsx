"use client";
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
import {
  ArticleCreationJournal,
  parseArticleCreationStatus,
  type ArticleCreationRecord,
} from "@/domain/content/article-creation-journal";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import { trpc } from "@/shared/api/trpc";
import { getQueryKey } from "@trpc/react-query";
import {
  useCursorPages,
  requireCursorPage,
} from "@/shared/api/use-cursor-pages";
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
  const { user } = useAuth();
  return user ? <ArticleEditor key={user.id} ownerId={user.id} /> : null;
}
function ArticleEditor({ ownerId }: { ownerId: number }) {
  const capabilities = useCapabilities();
  const utils = trpc.useUtils();
  const active = useScreenActive();
  const refreshRelatedContent = () => {
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
  const list = useCursorPages({
    key: getQueryKey(trpc.admin.articlesPage, { limit: 20 }, "query"),
    scope: String(ownerId),
    enabled: active && !showForm,
    fetchPage: (cursor, signal) =>
      utils.client.admin.articlesPage.query({ limit: 20, cursor }, { signal }),
  });
  const opening = useSessionOperation(active && !showForm);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCardRef = useRef<HTMLDivElement>(null);
  const {
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    fetchNextPage,
  } = list;
  const cardCount = list.items.length;
  useEffect(() => {
    if (
      !active ||
      showForm ||
      !hasNextPage ||
      isFetching ||
      isFetchingNextPage ||
      isError ||
      !lastCardRef.current ||
      !scrollRef.current
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: "200px" },
    );
    observer.observe(lastCardRef.current);
    return () => observer.disconnect();
  }, [
    active,
    showForm,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    fetchNextPage,
    cardCount,
  ]);
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [access, setAccess] = useState<Access>("club");
  const [previewing, setPreviewing] = useState(false);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([emptyBlock("text")]);
  const [journal] = useState(() => new ArticleCreationJournal(ownerId));
  const [creation, setCreation] = useState<ArticleCreationRecord | null>(null);
  const [storageStatus, setStorageStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void journal
      .load()
      .then((record) => {
        if (!alive) return;
        setCreation(record);
        setStorageStatus("ready");
        setRecoveryMessage(null);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStorageStatus("error");
        setRecoveryMessage(
          error instanceof Error
            ? error.message
            : "Не удалось прочитать операцию статьи",
        );
      });
    return () => {
      alive = false;
    };
  }, [journal, loadAttempt]);
  const deletion = useConfirmedAction(active && !showForm);
  const readArticles = async (signal: AbortSignal) => {
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
      void deletion.run({
        kind: "delete-article",
        label: "Удалить статью",
        read: async (signal) => {
          await inspectArticleDeletion(input.id, signal, false);
          refreshRelatedContent();
        },
        validate: requireOk,
        perform: async (signal) => {
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
      await requirePrivateUpload("privateContentUploads", signal);
      return utils.client.admin.uploadPrivateContentFile.mutate(input, {
        signal,
      });
    },
    status: (input: { idempotencyKey: string }, signal: AbortSignal) =>
      utils.client.admin.privateContentFileStatus.query(input, { signal }),
  };
  const uploading = operation.kind === "photos";
  const [published, setPublished] = useState(true);
  const uncertainSave = useRef(false);
  const restoreFiles = useRef<{
    editingId: number | null;
    files: PrivateArticleFile[];
  } | null>(null);
  const notify = (message: string) => {
    window.alert(message);
  };
  const reset = () => {
    operation.cancel();
    cover.detach();
    privateFiles.reset();
    restoreFiles.current = null;
    uncertainSave.current = false;
    setPublished(true);
    setEditingId(null);
    setShowForm(false);
    setTitle("");
    setCoverUrl("");
    setAccess("club");
    setPreviewing(false);
    setBlocks([emptyBlock("text")]);
  };
  const restoreCreation = (record: ArticleCreationRecord) => {
    operation.cancel();
    cover.detach();
    uncertainSave.current = false;
    setCreation(record);
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
  useEffect(() => {
    const record = restoreFiles.current;
    if (showForm && record && record.editingId === editingId) {
      restoreFiles.current = null;
      restorePrivateFiles(record.files);
    }
  }, [creation, showForm, editingId, restorePrivateFiles]);
  const restoreCover = () => {
    if (!cover.record || creation || storageStatus !== "ready") return;
    opening.cancel();
    operation.cancel();
    uncertainSave.current = false;
    const { snapshot, files } = cover.record;
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
  const readCurrentArticles = async (task: ScopedOperation) => {
    await readArticles(task.signal);
    task.assertCurrent();
  };
  const completeCreation = async (
    record: ArticleCreationRecord,
    task: ScopedOperation,
  ) => {
    await readCurrentArticles(task);
    task.assertCurrent();
    await journal.clear(record);
    task.assertCurrent();
    setCreation(null);
    setRecoveryMessage(null);
    refreshRelatedContent();
    reset();
  };
  const cancelEditing = async () => {
    operation.cancel();
    const task = operation.begin("cancel-article");
    if (!task) return;
    try {
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
          "Не удалось обновить список статей. Отмена не подтверждена; форма сохранена.",
        );
    } finally {
      task.finish();
    }
  };
  const recoverCreation = async (replay: boolean) => {
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
          const result = await utils.client.admin.updateArticle.mutate(
            { id: record.media.editingId, ...record.payload },
            { signal: task.signal },
          );
          requireOk(result);
          task.assertCurrent();
          await completeCreation(record, task);
          return;
        }
      } else if (record.media?.editingId) {
        await readCurrentArticles(task);
        setRecoveryMessage(
          "Результат изменения не подтверждён. Список обновлён. Проверьте статью; повторная запись не выполнялась.",
        );
        return;
      }
      const status = parseArticleCreationStatus(
        await utils.client.admin.articleCreationStatus.query(
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
      const id = await utils.client.admin.createArticle.mutate(
        { ...record.payload, idempotencyKey: record.idempotencyKey },
        { signal: task.signal },
      );
      if (!Number.isSafeInteger(id) || id <= 0) throw invalidResponse();
      task.assertCurrent();
      await completeCreation(record, task);
    } catch (error) {
      checkOperationAccessError(error);
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
  };
  const pickImages = async (
    multiple: boolean,
    commit: (urls: string[]) => void,
  ) => {
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
  const discardUnknownEdit = async () => {
    if (!creation?.media?.editingId || creation.media.phase !== "write") return;
    const task = operation.begin("discard-article");
    if (!task) return;
    try {
      await readCurrentArticles(task);
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
  const insertBlock = (index: number, type: ArticleBlock["type"]) => {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, emptyBlock(type));
      return next;
    });
  };
  const updateBlock = (index: number, patch: Partial<ArticleBlock>) => {
    const next = blocks.map((block, i) =>
      i === index ? { ...block, ...patch } : block,
    );
    privateFiles.prune(next);
    setBlocks(next);
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const to = index + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };
  const save = async () => {
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
    const task = operation.begin("save");
    if (!task) return;
    let storedCreation = false;
    let uploadingFiles = false;
    let writeStarted = false;
    try {
      const payload = {
        title: title.trim(),
        coverUrl: coverUrl || null,
        access,
        published,
        sections: blocks,
      };
      const selected = selectArticleFiles(blocks, privateFiles.files);
      if (selected.length) {
        await checkPrivateUploadAvailability(fileApi.status, task);
        const prepared = await journal.prepare(payload, {
          editingId,
          files: selected,
        });
        task.assertCurrent();
        storedCreation = true;
        setCreation(prepared.record);
        if (prepared.restored) {
          restoreCreation(prepared.record);
          return;
        }
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
        if (editingId)
          requireOk(
            await utils.client.admin.updateArticle.mutate(
              { id: editingId, ...record.payload },
              { signal: task.signal },
            ),
          );
        else {
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
      writeStarted = true;
      const result = await utils.client.admin.updateArticle.mutate(
        { id: editingId, ...payload },
        { signal: task.signal },
      );
      requireOk(result);
      task.assertCurrent();
      void list.restart();
      refreshRelatedContent();
      reset();
    } catch (error) {
      checkOperationAccessError(error);
      const status = getHttpStatus(error);
      const uploadRejection = uploadingFiles
        ? privateUploadRejectionMessage(error)
        : null;
      const uploadMessage = uploadRejection
        ? `${uploadRejection} Исходные файлы сохранены на этом устройстве. Проверьте загрузку позже.`
        : null;
      if (task.isCurrent() && editingId)
        uncertainSave.current = writeStarted && (!status || status >= 500);
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
      cover.detach();
      uncertainSave.current = false;
      setPublished(item.published);
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
    const run = () => remove.mutate({ id });
    {
      if (window.confirm("Удалить статью?")) run();
      return;
    }
  };
  if (showForm) {
    const busy = operation.busy;
    const pendingCreation =
      creation !== null && (creation.media?.editingId ?? null) === editingId;
    return (
      <ScrollArea contentClassName={classes.form}>
        {recoveryMessage ? (
          <StatusNotice tone="error">{recoveryMessage}</StatusNotice>
        ) : null}
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
        {cover.message ? (
          <StatusNotice tone="error">{cover.message}</StatusNotice>
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
              : "Только во вкладке Эксклюзив клуба, без библиотеки и без общей ленты."}
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
    <ScrollArea
      ref={scrollRef}
      contentClassName={classes.list}
      onRefresh={() => void list.restart()}
      refreshing={list.isRefetching && !list.isFetchingNextPage}
    >
      {recoveryMessage ? (
        <StatusNotice tone="error">{recoveryMessage}</StatusNotice>
      ) : null}
      {cover.message ? (
        <StatusNotice tone="error">{cover.message}</StatusNotice>
      ) : null}
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
          onClick={restoreCover}
        >
          Восстановить загрузку баннера
        </StatusNoticeAction>
      ) : null}
      {storageStatus === "error" ? (
        <StatusNoticeAction
          onClick={() => setLoadAttempt((value) => value + 1)}
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
      {deletion.error ? (
        <StatusNotice tone="error">{deletion.error}</StatusNotice>
      ) : null}
      {deletion.unknown && !deletion.operation.busy ? (
        <StatusNoticeAction onClick={() => void deletion.check()}>
          Обновить список
        </StatusNoticeAction>
      ) : null}
      <Action
        disabled={remove.isPending || opening.busy || storageStatus !== "ready"}
        onClick={() =>
          creation ? restoreCreation(creation) : setShowForm(true)
        }
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
        Два варианта: только Эксклюзив клуба по подписке или Эксклюзив +
        библиотека с чтением без подписки. В общую ленту статьи не попадают.
      </Typography>
      <QueryRetryState
        isLoading={list.isLoading}
        isError={list.isError && !list.isFetchNextPageError}
        onRetry={() => void list.refetch()}
        message="Не удалось загрузить статьи"
      />
      <QueryRetryState
        isLoading={opening.busy}
        isError={Boolean(openingError)}
        onRetry={() => {
          if (openingId !== null) void startEdit(openingId);
        }}
        message={openingError ?? "Не удалось загрузить статью"}
      />
      {list.items.map((item, index) => (
        <div
          key={item.id}
          ref={index === list.items.length - 1 ? lastCardRef : undefined}
          className={["ui-stack ", classes.card].filter(Boolean).join(" ")}
        >
          {item.coverUrl ? (
            <Picture
              source={{ uri: item.coverUrl }}
              contentFit="cover"
              className={classes.cardCover}
            />
          ) : null}
          <div className={["ui-stack ", classes.div].filter(Boolean).join(" ")}>
            <Typography className={classes.cardTitle}>{item.title}</Typography>
            <Typography className={classes.cardMeta}>
              {item.access === "public" ? "Клуб + библиотека" : "Эксклюзив"}
              {item.published ? "" : " · черновик"}
            </Typography>
            <div
              className={["ui-stack ", classes.row].filter(Boolean).join(" ")}
            >
              <Action
                disabled={remove.isPending || opening.busy}
                onClick={() => void startEdit(item.id)}
                className={classes.linkBtn}
              >
                <Typography className={classes.btnSecondaryText}>
                  Править
                </Typography>
              </Action>
              <Action
                disabled={remove.isPending || opening.busy}
                onClick={() => confirmDelete(item.id)}
                className={classes.linkBtn}
              >
                <Typography className={classes.typography}>Удалить</Typography>
              </Action>
            </div>
          </div>
        </div>
      ))}
      <QueryRetryState
        isLoading={list.isFetchingNextPage}
        isError={list.isFetchNextPageError}
        loadingSize="small"
        onRetry={() => void list.fetchNextPage()}
        message="Не удалось загрузить следующие статьи"
      />
      {!list.isLoading && !list.isError && !list.items.length ? (
        <Typography className={classes.hint}>
          Пока нет статей — напишите подборку, гид или «обо мне».
        </Typography>
      ) : null}
    </ScrollArea>
  );
}
