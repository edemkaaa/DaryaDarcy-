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
import { trpc } from "@/shared/api/trpc";
import { ArticleContent } from "@/domain/content/article-content";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { requireUploadedUrl } from "@/shared/media/upload-result";
import { getHttpStatus, invalidResponse } from "@/shared/api/errors";
import { privateUploadRejectionMessage } from "@/shared/api/upload-errors";
import { useConfirmedAction } from "@/domain/session/use-confirmed-action";
import {
  requireOk,
  requireAbsentId,
  requireIdList,
} from "@/shared/api/action-result";
import { fileToUpload, pickWebFiles } from "@/shared/media/image-upload";
import { useArticleFiles } from "./use-article-files";
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
  const utils = trpc.useUtils();
  const list = trpc.admin.articles.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
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
  const deletion = useConfirmedAction(!showForm);
  const readArticles = async () => {
    const result = await list.refetch();
    if (!result.isSuccess || !Array.isArray(result.data))
      throw result.error ?? invalidResponse();
    requireIdList(result.data);
  };
  const remove = {
    isPending: deletion.blocked,
    mutate: (input: { id: number }) =>
      void deletion.run({
        kind: "delete-article",
        label: "Удалить статью",
        read: readArticles,
        validate: requireOk,
        perform: async (signal) => {
          const result = await utils.client.admin.deleteArticle.mutate(input, {
            signal,
          });
          requireOk(result);
          const refreshed = await list.refetch();
          if (!refreshed.isSuccess || !Array.isArray(refreshed.data))
            throw refreshed.error ?? invalidResponse();
          requireAbsentId(refreshed.data, input.id);
          return result;
        },
        commit: () => {
          void utils.articles.list.invalidate();
          void utils.club.list.invalidate();
        },
      }),
  };
  const operation = useSessionOperation(showForm, editingId);
  const privateFiles = useArticleFiles(showForm, editingId);
  const restorePrivateFiles = privateFiles.restore;
  const fileApi = {
    upload: (
      input: Parameters<
        typeof utils.client.admin.uploadPrivateContentFile.mutate
      >[0],
      signal: AbortSignal,
    ) => utils.client.admin.uploadPrivateContentFile.mutate(input, { signal }),
    status: (input: { idempotencyKey: string }, signal: AbortSignal) =>
      utils.client.admin.privateContentFileStatus.query(input, { signal }),
  };
  const uploading = operation.kind === "photos";
  const [published, setPublished] = useState(true);
  const uncertainSave = useRef(false);
  const restoreFiles = useRef<ArticleCreationRecord | null>(null);
  const notify = (message: string) => {
    window.alert(message);
  };
  const reset = () => {
    operation.cancel();
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
    uncertainSave.current = false;
    setCreation(record);
    const payload = structuredClone(record.payload);
    setEditingId(record.media?.editingId ?? null);
    setTitle(payload.title);
    setCoverUrl(payload.coverUrl || "");
    setAccess(payload.access);
    setPublished(payload.published);
    setBlocks(payload.sections);
    restoreFiles.current = record;
    // Restore after the editing scope has rendered; the keyed effect below owns the URLs.
    setPreviewing(false);
    setShowForm(true);
  };
  useEffect(() => {
    const record = restoreFiles.current;
    if (showForm && record && (record.media?.editingId ?? null) === editingId) {
      restoreFiles.current = null;
      restorePrivateFiles(record.media?.files ?? []);
    }
  }, [creation, showForm, editingId, restorePrivateFiles]);
  const readCurrentArticles = async (task: ScopedOperation) => {
    await utils.admin.articles.cancel();
    task.assertCurrent();
    const articles = await utils.client.admin.articles.query(undefined, {
      signal: task.signal,
    });
    task.assertCurrent();
    requireIdList(articles);
    await utils.admin.articles.cancel();
    task.assertCurrent();
    utils.admin.articles.setData(undefined, articles);
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
    void utils.articles.list.invalidate();
    void utils.club.list.invalidate();
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
    preserveAlpha: boolean,
    multiple: boolean,
    commit: (urls: string[]) => void,
    publicCover = false,
  ) => {
    const task = operation.begin("photos");
    if (!task) return;
    const urls: string[] = [];
    try {
      if (!publicCover) {
        const selected = await privateFiles.photos(multiple, task);
        task.assertCurrent();
        if (selected.length) commit(selected);
        return;
      }
      const files = await pickWebFiles(
        preserveAlpha ? "image/png,image/webp" : "image/*",
        multiple,
        { signal: task.signal },
      );
      for (const file of files) {
        const payload = await fileToUpload(file, {
          preserveAlpha,
          signal: task.signal,
        });
        task.assertCurrent();
        const url = requireUploadedUrl(
          await utils.client.admin.uploadPhoto.mutate(payload, {
            signal: task.signal,
          }),
        );
        task.assertCurrent();
        urls.push(url);
      }
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        notify(
          error instanceof Error ? error.message : "Не удалось загрузить файл",
        );
    } finally {
      if (task.isCurrent() && urls.length) commit(urls);
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
      const result = await utils.client.admin.updateArticle.mutate(
        { id: editingId, ...payload },
        { signal: task.signal },
      );
      requireOk(result);
      task.assertCurrent();
      void utils.admin.articles.invalidate();
      void utils.articles.list.invalidate();
      void utils.club.list.invalidate();
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
        uncertainSave.current = !status || status >= 500;
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
  const startEdit = (item: {
    id: number;
    title: string;
    coverUrl: string | null;
    access: Access;
    published: boolean;
    sections: unknown;
  }) => {
    operation.cancel();
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
          <Typography role="alert">{recoveryMessage}</Typography>
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
        <div inert={busy || pendingCreation} style={{ display: "contents" }}>
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
                  pickImages(
                    false,
                    false,
                    (urls) => {
                      if (urls[0]) setCoverUrl(urls[0]);
                    },
                    true,
                  )
                }
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
                        onClick={() =>
                          pickImages(false, true, (urls) =>
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
                        onClick={() =>
                          pickImages(block.type === "png", true, (urls) => {
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
    <ScrollArea contentClassName={classes.list}>
      {recoveryMessage ? (
        <Typography role="alert">{recoveryMessage}</Typography>
      ) : null}
      {storageStatus === "error" ? (
        <Action onClick={() => setLoadAttempt((value) => value + 1)}>
          Повторить чтение операции
        </Action>
      ) : null}
      {creation ? (
        <Typography className={classes.hint}>
          Есть незавершённая операция создания статьи. Восстановите её перед
          новой статьёй.
        </Typography>
      ) : null}
      {deletion.error ? (
        <Typography role="alert">{deletion.error}</Typography>
      ) : null}
      {deletion.unknown && !deletion.operation.busy ? (
        <Action onClick={() => void deletion.check()}>Обновить список</Action>
      ) : null}
      <Action
        disabled={remove.isPending || storageStatus !== "ready"}
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
        isError={list.isError}
        onRetry={() => void list.refetch()}
        message="Не удалось загрузить статьи"
      />
      {(list.data || []).map((item) => (
        <div
          key={item.id}
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
              {item.published ? "" : " · черновик"} ·{" "}
              {(item.sections || []).length} бл.
            </Typography>
            <div
              className={["ui-stack ", classes.row].filter(Boolean).join(" ")}
            >
              <Action
                disabled={remove.isPending}
                onClick={() => startEdit(item)}
                className={classes.linkBtn}
              >
                <Typography className={classes.btnSecondaryText}>
                  Править
                </Typography>
              </Action>
              <Action
                disabled={remove.isPending}
                onClick={() => confirmDelete(item.id)}
                className={classes.linkBtn}
              >
                <Typography className={classes.typography}>Удалить</Typography>
              </Action>
            </div>
          </div>
        </div>
      ))}
      {!list.isLoading && !list.isError && !(list.data || []).length ? (
        <Typography className={classes.hint}>
          Пока нет статей — напишите подборку, гид или «обо мне».
        </Typography>
      ) : null}
    </ScrollArea>
  );
}
