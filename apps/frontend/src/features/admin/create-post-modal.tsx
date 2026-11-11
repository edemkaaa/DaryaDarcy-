"use client";
/** Быстрый редактор использует общий координатор поста, сохраняя свой слот черновика и выбранные вложения. */
import classes from "./create-post-modal.module.scss";
import {
  Dialog,
  Action,
  Typography,
  Spinner,
  ScrollArea,
} from "@/shared/ui/elements";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { trpc } from "@/shared/api/trpc";

import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { MAX_VIDEO_BYTES } from "@/shared/browser/file-operations";
import { PostSaveCoordinator } from "@/domain/post/save-post";
import { createPostEditorApi } from "./post-editor-api";
import { VkVideoField, VkVideoPreviewButton } from "./vk-video-field";
import { usePostAttachments } from "./use-post-attachments";
import { usePostUploadSelection } from "./use-post-upload-selection";
import { PostUploadStatus } from "./post-upload-status";
import { PostEditorTags } from "./post-editor-tags";
import { PostRecoveryNotice } from "./post-recovery-notice";
import { usePostRecovery } from "./use-post-recovery";
import { usePostEditComparison } from "./use-post-edit-comparison";
import { readEditRevision } from "@/domain/content/edit-revision";
import { usePrivatePostPhotos } from "./use-private-post-photos";
import { usePrivatePostVideos } from "./use-private-post-videos";
import { useAuth } from "@/domain/session/session-context";
import {
  requirePrivateUpload,
  useCapabilities,
  uploadUnavailableMessage,
} from "@/shared/api/capabilities";
import { PostAttachmentsField } from "./post-attachments-field";
import { pickWebFiles } from "@/shared/media/image-upload";
import { PhotoEditor } from "@/features/admin/photo-editor";
import { ScheduleDatetime } from "@/features/admin/schedule-datetime";
import { tagsForTarget } from "@/domain/post/post-tags";
import {
  RichTextField,
  type RichTextFieldHandle,
} from "@/features/admin/rich-text-field";
import type { RichTextBlock } from "@/domain/content/types";
import { serializePostDraft, postDraftSnapshot } from "@/domain/post/draft";
import {
  CREAM_BG,
  BROWN_DARK,
  BROWN_LIGHT,
  ACCENT,
} from "./create-post-modal.content";
type PostTarget = "feed" | "club" | "both";
type PostStatus = "draft" | "scheduled" | "published";
interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  defaultTarget: PostTarget;
  editingPost?: {
    id: number;
    text: string;
    photos: string[];
    tags: string[];
    status: PostStatus;
    target: PostTarget;
    richText?: RichTextBlock[] | null;
    scheduledAt: string | null;
    publishedAt?: string | null;
    createdAt?: string | null;
    media?: {
      id: number;
      type: string;
      url: string;
      filename?: string | null;
      mimeType?: string | null;
    }[];
    editRevision?: string;
  } | null;
}
export function CreatePostModal(props: CreatePostModalProps) {
  // Ключ владельца, поста и целевого раздела изолирует быстрый редактор от предыдущего аккаунта и формы.

  const { user } = useAuth();
  return (
    <CreatePostModalBody
      key={`${user?.id ?? "guest"}:${props.editingPost?.id ?? "new"}:${props.defaultTarget}`}
      {...props}
    />
  );
}
function CreatePostModalBody({
  visible,
  onClose,
  defaultTarget,
  editingPost,
}: CreatePostModalProps) {
  // Использует тот же координатор и контракты файлов, что полный редактор, но отдельный quick-слот локального журнала.

  const capabilities = useCapabilities();
  const [text, setText] = useState(editingPost?.text || "");
  const [photos, setPhotos] = useState<string[]>(editingPost?.photos || []);
  const [tags, setTags] = useState<string[]>(editingPost?.tags || []);
  const [target, setTarget] = useState<PostTarget>(
    editingPost?.target || defaultTarget,
  );
  const [status, setStatus] = useState<PostStatus>(
    editingPost?.status || "published",
  );
  const [scheduledAt, setScheduledAt] = useState<Date | null>(
    editingPost?.scheduledAt ? new Date(editingPost.scheduledAt) : null,
  );
  const [publishedAt, setPublishedAt] = useState<Date>(() => new Date());
  const operation = useSessionOperation(visible, editingPost?.id ?? null);
  const cancelOperation = operation.cancel;
  const uploading = operation.kind === "photos";
  const mediaUploading = operation.kind === "video";
  const [videos, setVideos] = useState<string[]>([]);
  const notifyError = (message: string) => /* Оставляет форму на месте при ошибке, показывая сообщение вместо сброса ввода. */ window.alert(message);
  const {
    attachments: mediaAttachments,
    removedIds: removedMediaIds,
    reset: resetAttachments,
    pick: pickAttachment,
    remove: removeMedia,
    restore: restoreAttachments,
    markRemoved: markMediaRemoved,
  } = usePostAttachments(operation, notifyError);
  const [richText, setRichText] = useState<RichTextBlock[] | undefined>();
  const [richTextSeed, setRichTextSeed] = useState<
    RichTextBlock[] | null | undefined
  >(null);
  const [draftKey, setDraftKey] = useState(0);
  const richTextFieldRef = useRef<RichTextFieldHandle>(null);
  const utils = trpc.useUtils();
  const invalidateAdminReads = () => {
    // Обновляет короткие страницы, календарь и счётчики после записи, не перечитывая полный каталог синхронно.

    void utils.admin.posts.invalidate();
    void utils.admin.postsPage.invalidate();
    void utils.admin.postCalendar.invalidate();
    void utils.admin.postCounts.invalidate();
    void utils.admin.stats.invalidate();
  };
  const saveCoordinator = useRef(
    new PostSaveCoordinator(editingPost?.id ?? null),
  );
  const uploadSelection = usePostUploadSelection();
  const privatePhotos = usePrivatePostPhotos(
    visible,
    `${editingPost?.id ?? "new"}:${defaultTarget}`,
  );
  const privateVideos = usePrivatePostVideos(
    visible,
    `${editingPost?.id ?? "new"}:${defaultTarget}`,
  );
  const resetUploads = uploadSelection.reset;
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    // Начальное заполнение выполняется один раз для слота: повторный refetch исходного поста не должен затирать введённый текст.

    if (!visible) {
      seeded.current = null;
      return;
    }
    const seedKey = `${editingPost?.id ?? "new"}:${defaultTarget}`;
    if (seeded.current === seedKey) return;
    seeded.current = seedKey;
    cancelOperation();
    resetUploads();
    setText(editingPost?.text || "");
    setPhotos(editingPost?.photos || []);
    setTags(editingPost?.tags || []);
    setTarget(editingPost?.target || defaultTarget);
    setStatus(editingPost?.status || "published");
    setScheduledAt(
      editingPost?.scheduledAt ? new Date(editingPost.scheduledAt) : null,
    );
    const initialDate = editingPost?.publishedAt
      ? new Date(editingPost.publishedAt)
      : editingPost?.createdAt
        ? new Date(editingPost.createdAt)
        : new Date();
    const date = Number.isNaN(initialDate.getTime()) ? new Date() : initialDate;
    const initialVideos =
      editingPost?.media?.filter((m) => m.type === "video").map((m) => m.url) ??
      [];
    saveCoordinator.current = new PostSaveCoordinator(
      editingPost?.id ?? null,
      editingPost
        ? postDraftSnapshot({
            text: editingPost.text,
            photos: editingPost.photos,
            videos: initialVideos,
            tags: editingPost.tags,
            status: editingPost.status,
            target: editingPost.target,
            scheduledAt: editingPost.scheduledAt
              ? new Date(editingPost.scheduledAt)
              : null,
            publishedAt: date,
            sortOrder: 0,
            richText: editingPost.richText,
          })
        : undefined,
      editingPost ? readEditRevision(editingPost) : undefined,
    );
    setPublishedAt(date);
    setRichTextSeed(editingPost?.richText ?? null);
    setRichText(editingPost?.richText ?? undefined);
    setVideos(initialVideos);
    resetAttachments(editingPost?.media);
  }, [
    visible,
    editingPost,
    defaultTarget,
    cancelOperation,
    resetAttachments,
    resetUploads,
  ]);
  const editorSnapshot = useMemo(
    () => /* Собирает неизменяемый снимок всех полей и выбранных File для восстановления одной фазы. */ ({
      draft: {
        text,
        photos,
        videos,
        tags,
        target,
        status,
        scheduledAt,
        publishedAt,
        sortOrder: 0,
        richText: richText ?? null,
      },
      attachments: mediaAttachments,
      removedIds: removedMediaIds,
      pending: uploadSelection.pending,
      privatePhotos: privatePhotos.photos,
      privateVideos: privateVideos.videos,
    }),
    [
      text,
      photos,
      videos,
      tags,
      target,
      status,
      scheduledAt,
      publishedAt,
      richText,
      mediaAttachments,
      removedMediaIds,
      uploadSelection.pending,
      privatePhotos.photos,
      privateVideos.videos,
    ],
  );
  // Быстрый редактор использует собственный слот, поэтому его ввод не затирает черновик полного редактора того же поста.
  const recovery = usePostRecovery({
    active: visible,
    slot: `quick:${editingPost?.id ?? `new:${defaultTarget}`}`,
    editor: editorSnapshot,
    coordinator: saveCoordinator,
    onRestore: (snapshot) => {
      // Восстанавливает текст, даты, форматирование, удаления и ожидания из той же контрольной точки, что File.

      privatePhotos.restore(
        snapshot.privatePhotos ?? [],
        snapshot.draft.photos,
      );
      privateVideos.restore(
        snapshot.privateVideos ?? [],
        snapshot.draft.videos,
      );
      const draft = snapshot.draft;
      setText(draft.text);
      setPhotos(draft.photos);
      setVideos(draft.videos);
      setTags(draft.tags);
      setTarget(draft.target);
      setStatus(draft.status);
      setScheduledAt(draft.scheduledAt);
      setPublishedAt(draft.publishedAt);
      setRichText(draft.richText ?? undefined);
      setRichTextSeed(draft.richText ?? null);
      setDraftKey((key) => key + 1);
      restoreAttachments(snapshot.attachments, snapshot.removedIds);
      uploadSelection.restore(snapshot.pending);
    },
  });
  const postApi = createPostEditorApi(utils.client);
  const editComparison = usePostEditComparison(
    saveCoordinator,
    recovery,
    postApi,
    operation,
    editorSnapshot,
  );
  const closeEditor = () => {
    // Очищает ресурсы и видимое состояние, но не удаляет серверные файлы; журнал очищает вызывающий подтверждённый путь.

    privatePhotos.reset();
    privateVideos.reset();
    operation.cancel();
    resetUploads();
    setText("");
    setPhotos([]);
    setTags([]);
    setTarget(defaultTarget);
    setStatus("published");
    setScheduledAt(null);
    setVideos([]);
    resetAttachments();
    setRichText(undefined);
    setRichTextSeed(null);
    if (!editingPost) setDraftKey((key) => key + 1);
    onClose();
  };
  const discardRecovery = async () => {
    // Явный отказ от локальной копии не означает отмену уже отправленного запроса.

    if (
      !window.confirm(
        "Удалить локальную копию? Если сохранение или загрузка не подтверждены, сначала проверьте список публикаций в другой вкладке. Файлы на сервере не удаляются.",
      )
    )
      return;
    try {
      await recovery.clear();
      closeEditor();
    } catch (error) {
      notifyError((error as Error).message);
    }
  };
  const finishRecovery = async () => {
    // После подтверждённого сохранения очищает журнал и инвалидирует административные и пользовательские списки.

    try {
      await recovery.clear();
      invalidateAdminReads();
      void utils.feed.listPaginated.invalidate();
      void utils.club.listByCategory.invalidate();
      closeEditor();
    } catch (error) {
      notifyError((error as Error).message);
    }
  };
  const recoverCreation = async () => {
    // Продолжает uploads либо создание исходного координатора, не создавая новый ключ для потерянного ответа.

    const task = operation.begin("save");
    if (!task) return;
    try {
      if (saveCoordinator.current.snapshot().phase === "upload") {
        await saveCoordinator.current.recoverUploads(postApi, task);
        return;
      }
      await saveCoordinator.current.recoverCreation(postApi, task);
      task.assertCurrent();
      await recovery.clear();
      task.assertCurrent();
      invalidateAdminReads();
      void utils.feed.listPaginated.invalidate();
      void utils.club.listByCategory.invalidate();
      closeEditor();
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) notifyError((error as Error).message);
    } finally {
      task.finish();
    }
  };
  const handleClose = async () => {
    // Проверяет безопасную фазу координатора и наличие изменений перед очисткой журнала и закрытием.

    if (recovery.status === "loading" || recovery.status === "offered") {
      closeEditor();
      return;
    }
    try {
      saveCoordinator.current.assertCanClose();
    } catch (error) {
      notifyError((error as Error).message);
      return;
    }
    const changed =
      text !== (editingPost?.text ?? "") ||
      JSON.stringify(photos) !== JSON.stringify(editingPost?.photos ?? []) ||
      mediaAttachments.some((item) => item.file) ||
      removedMediaIds.length > 0 ||
      JSON.stringify(richText ?? null) !==
        JSON.stringify(editingPost?.richText ?? null) ||
      JSON.stringify(videos) !==
        JSON.stringify(
          editingPost?.media
            ?.filter((m) => m.type === "video")
            .map((m) => m.url) ?? [],
        ) ||
      JSON.stringify(tags) !== JSON.stringify(editingPost?.tags ?? []) ||
      status !== (editingPost?.status ?? "published") ||
      target !== (editingPost?.target ?? defaultTarget);
    if (
      (changed || operation.busy || uploadSelection.pending.length) &&
      !window.confirm(
        "Закрыть редактор? Несохранённые изменения будут потеряны.",
      )
    )
      return;
    try {
      await recovery.clear();
      closeEditor();
    } catch (error) {
      notifyError((error as Error).message);
    }
  };
  const addVideoUrl = (url: string) => {
    // Согласованно добавляет уникальную видеоссылку и тег video в локальную форму.

    setVideos((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setTags((prev) => (prev.includes("video") ? prev : [...prev, "video"]));
  };
  const pickVideo = async () => {
    // Проверяет серверную возможность и размер, затем сохраняет локальный File для будущей общей записи поста.

    if (recovery.blocked) return;
    const task = operation.begin("video");
    if (!task) return;
    try {
      await requirePrivateUpload("privatePostVideoUploads", task.signal);
      uploadSelection.assertReady();
      const files = await pickWebFiles("video/*", false, {
        signal: task.signal,
        maxBytes: MAX_VIDEO_BYTES,
      });
      if (!files.length) return;
      task.assertCurrent();
      const reference = await privateVideos.add(files[0], task);
      task.assertCurrent();
      addVideoUrl(reference);
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        notifyError(
          error instanceof Error ? error.message : "Не удалось загрузить видео",
        );
    } finally {
      task.finish();
    }
  };
  const removeVideo = (index: number) => {
    // Снимает ссылку из формы и помечает удаление только настоящего приватного серверного вложения.

    if (operation.busy || recovery.blocked) return;
    const reference = videos[index];
    if (!reference) return;
    privateVideos.remove(reference);
    const existing = editingPost?.media?.find(
      (item) =>
        item.type === "video" &&
        item.url === reference &&
        reference === `/api/media/post-attachments/${item.id}`,
    );
    if (existing) markMediaRemoved(existing.id);
    setVideos((previous) => previous.filter((_, i) => i !== index));
  };
  const replacePhoto = async (index: number) => {
    // Захватывает исходную ссылку, сохраняет намерение и заменяет только тот слот, который не изменился во время выбора.

    const task = operation.begin("photos");
    if (!task) return;
    const previous = photos[index];
    let selected: number | undefined;
    try {
      await requirePrivateUpload("privateContentUploads", task.signal);
      uploadSelection.assertReady();
      const files = await pickWebFiles("image/*", false, {
        signal: task.signal,
      });
      if (!files.length) return;
      task.assertCurrent();
      [selected] = uploadSelection.select(files);
      uploadSelection.sending(selected);
      await recovery.checkpoint(undefined, uploadSelection.snapshot());
      task.assertCurrent();
      const url = await privatePhotos.add(files[0], task);
      task.assertCurrent();
      uploadSelection.confirmed(selected);
      privatePhotos.removePreview(previous);
      setPhotos((prev) =>
        prev.map((photo, i) =>
          i === index && photo === previous ? url : photo,
        ),
      );
    } catch (error) {
      if (task.isCurrent()) uploadSelection.failed(selected, error);
      checkOperationAccessError(error);
      if (task.isCurrent())
        notifyError(
          error instanceof Error ? error.message : "Не удалось заменить фото",
        );
    } finally {
      task.finish();
    }
  };
  const handleSubmit = async () => {
    // Валидирует содержимое и даты, фиксирует черновик до сети и закрывает форму лишь после подтверждения координатора.

    if (recovery.blocked) return;
    if (editingPost && !Array.isArray(editingPost.media)) {
      notifyError(
        "Не удалось загрузить вложения поста. Изменения оставлены в редакторе. Дождитесь сохранения черновика на этом устройстве и обновите страницу.",
      );
      return;
    }
    if (
      !text.trim() &&
      photos.length === 0 &&
      videos.length === 0 &&
      mediaAttachments.length === 0
    ) {
      notifyError("Добавьте текст, фото, видео, аудио или документ");
      return;
    }
    if (
      status === "scheduled" &&
      (!scheduledAt || Number.isNaN(scheduledAt.getTime()))
    ) {
      notifyError("Выберите дату и время публикации");
      return;
    }
    if (status !== "scheduled" && Number.isNaN(publishedAt.getTime())) {
      notifyError("Выберите дату публикации");
      return;
    }
    const task = operation.begin("save");
    if (!task) return;
    try {
      uploadSelection.assertReady();
      await recovery.checkpoint();
      task.assertCurrent();
      const payload = serializePostDraft({
        text,
        photos,
        videos,
        tags,
        status,
        target,
        scheduledAt,
        publishedAt,
        sortOrder: 0,
        richText:
          richTextFieldRef.current?.getRichTextBlocksForSubmit() ??
          richTextFieldRef.current?.getRichTextBlocks() ??
          richText ??
          null,
      });
      // Координатор связывает подтверждённые загрузки и запись поста; UI не должен повторять ни одну фазу самостоятельно.
      await saveCoordinator.current.save(
        payload,
        mediaAttachments,
        removedMediaIds,
        postApi,
        task,
        privatePhotos.photos,
        privateVideos.videos,
      );
      task.assertCurrent();
      await recovery.clear();
      task.assertCurrent();
      // Cache refresh is independent of a confirmed write and must not delay closing the editor.
      invalidateAdminReads();
      void utils.admin.scheduledPosts.invalidate();
      void utils.feed.list.invalidate();
      void utils.feed.listPaginated.invalidate();
      void utils.club.listByCategory.invalidate();
      closeEditor();
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось сохранить публикацию";
        notifyError(message);
      }
    } finally {
      task.finish();
    }
  };
  const pickPhotos = async () => {
    // Последовательно подготавливает выбранные фото, сохраняя фазы каждого выбора и уже добавленные файлы при частичном отказе.

    const task = operation.begin("photos");
    if (!task) return;
    let uploaded = 0;
    let selected: number | undefined;
    try {
      await requirePrivateUpload("privateContentUploads", task.signal);
      uploadSelection.assertReady();
      const files = await pickWebFiles("image/*,.heic,.heif", true, {
        signal: task.signal,
      });
      task.assertCurrent();
      const selections = uploadSelection.select(files);
      await recovery.checkpoint(undefined, uploadSelection.snapshot());
      task.assertCurrent();
      for (const [index, file] of files.entries()) {
        selected = selections[index];
        uploadSelection.sending(selected);
        await recovery.checkpoint(undefined, uploadSelection.snapshot());
        task.assertCurrent();
        const url = await privatePhotos.add(file, task);
        task.assertCurrent();
        uploadSelection.confirmed(selected);
        setPhotos((prev) => [...prev, url]);
        uploaded++;
      }
    } catch (error) {
      if (task.isCurrent()) uploadSelection.failed(selected, error);
      checkOperationAccessError(error);
      if (task.isCurrent())
        notifyError(
          `${error instanceof Error ? error.message : "Не удалось загрузить фото"}${uploaded ? `\nУже добавлено фото: ${uploaded}.` : ""}`,
        );
    } finally {
      task.finish();
    }
  };
  const removePhoto = (index: number) => {
    // Удаляет ссылку и локальный адрес фото только вне работающей операции.

    if (operation.busy) return;
    privatePhotos.removePreview(photos[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };
  const movePhoto = (fromIndex: number, direction: "left" | "right") => {
    // Кнопочная перестановка изменяет ссылки в массиве без повторной отправки файлов.

    if (operation.busy) return;
    setPhotos((prev) => {
      const arr = [...prev];
      const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= arr.length) return prev;
      [arr[fromIndex], arr[toIndex]] = [arr[toIndex], arr[fromIndex]];
      return arr;
    });
  };
  const reorderPhotos = (fromIndex: number, toIndex: number) => {
    // Drag переносит один элемент между проверенными индексами; сохранение поста остаётся отдельным действием.

    if (operation.busy) return;
    setPhotos((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const arr = [...prev];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return arr;
    });
  };
  const toggleTag = useCallback((slug: string) => {
    // Обновляет набор slug функционально, не теряя быстрые нажатия между рендерами.

    setTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );
  }, []);
  const availableTags = tagsForTarget(target);
  const isPending = operation.busy;
  if (!visible) return null;
  return (
    <Dialog
      label="Редактор публикации"
      open
      motion="slide"
      className={classes.editorDialog}
      onClose={handleClose}
    >
      <div
        className={["ui-stack ", classes.container].filter(Boolean).join(" ")}
      >
        {/* Header */}
        <div
          className={["ui-stack ", classes.header].filter(Boolean).join(" ")}
        >
          <Action
            onClick={handleClose}
            aria-label="Закрыть редактор"
            hitArea={6}
            className={({ pressed }) =>
              [
                classes.closeButton,
                pressed ? classes.opacityState : classes.opacityState2,
              ].join(" ")
            }
          >
            <MaterialIcons name="close" size={24} color={BROWN_DARK} />
          </Action>
          <Typography className={classes.headerTitle}>
            {editingPost ? "Редактировать" : "Новый пост"}
          </Typography>
          <Action
            onClick={handleSubmit}
            disabled={isPending || recovery.blocked}
            hitArea={6}
            aria-busy={isPending}
            aria-label={
              editingPost
                ? "Сохранить"
                : status === "scheduled"
                  ? "Запланировать"
                  : status === "draft"
                    ? "Черновик"
                    : "Опубликовать"
            }
            className={({ pressed }) =>
              [
                classes.action,
                pressed || isPending
                  ? classes.opacityState3
                  : classes.opacityState4,
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {isPending ? (
              <Spinner size="small" color={CREAM_BG} />
            ) : (
              <Typography className={classes.submitBtnText}>
                {editingPost
                  ? "Сохранить"
                  : status === "scheduled"
                    ? "Запланировать"
                    : status === "draft"
                      ? "Черновик"
                      : "Опубликовать"}
              </Typography>
            )}
          </Action>
        </div>

        <PostRecoveryNotice
          recovery={recovery}
          busy={operation.busy}
          onRecover={() => void recoverCreation()}
          onFinish={() => void finishRecovery()}
          onDiscard={() => void discardRecovery()}
        />
        {editComparison}
        <PostUploadStatus selection={uploadSelection} busy={operation.busy} />

        <ScrollArea
          contentInert={operation.busy || recovery.blocked}
          className={[
            classes.scroll,
            recovery.status === "loading" ? classes.formLoading : "",
          ]
            .filter(Boolean)
            .join(" ")}
          contentClassName={classes.scrollContent}
        >
          {/* Target selector */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>
              Куда публикуем
            </Typography>
            <div
              className={["ui-stack ", classes.targetRow]
                .filter(Boolean)
                .join(" ")}
            >
              {(["feed", "club", "both"] as PostTarget[]).map((t) => (
                <Action
                  key={t}
                  onClick={() => setTarget(t)}
                  className={[
                    classes.targetChipActive,
                    target === t
                      ? classes.appearanceState
                      : classes.appearanceState2,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <MaterialIcons
                    name={
                      t === "feed"
                        ? "dynamic-feed"
                        : t === "club"
                          ? "groups"
                          : "public"
                    }
                    size={16}
                    color={target === t ? CREAM_BG : BROWN_LIGHT}
                  />
                  <Typography
                    className={[
                      classes.targetChipTextActive,
                      target === t ? classes.colorState : classes.colorState2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {t === "feed" ? "Лента" : t === "club" ? "Клуб" : "Везде"}
                  </Typography>
                </Action>
              ))}
            </div>
          </div>

          {/* Status selector */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>Статус</Typography>
            <div
              className={["ui-stack ", classes.targetRow]
                .filter(Boolean)
                .join(" ")}
            >
              {(["published", "scheduled", "draft"] as PostStatus[]).map(
                (s) => (
                  <Action
                    key={s}
                    onClick={() => {
                      setStatus(s);
                      if (s === "scheduled" && !scheduledAt) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(10, 0, 0, 0);
                        setScheduledAt(tomorrow);
                      }
                    }}
                    className={[
                      classes.targetChipActive,
                      status === s
                        ? classes.appearanceState3
                        : classes.appearanceState4,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <MaterialIcons
                      name={
                        s === "published"
                          ? "visibility"
                          : s === "scheduled"
                            ? "schedule"
                            : "edit-note"
                      }
                      size={16}
                      color={status === s ? CREAM_BG : BROWN_LIGHT}
                    />
                    <Typography
                      className={[
                        classes.targetChipTextActive,
                        status === s
                          ? classes.colorState3
                          : classes.colorState4,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {s === "published"
                        ? "Опубликовать"
                        : s === "scheduled"
                          ? "Отложить"
                          : "Черновик"}
                    </Typography>
                  </Action>
                ),
              )}
            </div>
          </div>

          {/* Scheduled date picker */}
          {status === "scheduled" && (
            <div
              className={["ui-stack ", classes.section]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.sectionLabel}>
                Дата и время публикации
              </Typography>
              <ScheduleDatetime value={scheduledAt} onChange={setScheduledAt} />
              <Typography className={classes.hint}>
                Пост выйдет сам в выбранное время, открывать админку не нужно.
              </Typography>
            </div>
          )}

          {status !== "scheduled" && (
            <div
              className={["ui-stack ", classes.section]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.sectionLabel}>
                Дата публикации
              </Typography>
              <ScheduleDatetime
                value={publishedAt}
                onChange={setPublishedAt}
                allowPast
              />
              <Typography className={classes.hint}>
                Пост встанет в ленте по этой дате, можно выбрать прошлую.
              </Typography>
            </div>
          )}

          {/* Text input with formatting toolbar */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>Текст</Typography>
            <RichTextField
              ref={richTextFieldRef}
              key={editingPost?.id ?? `draft-${draftKey}`}
              value={text}
              onValueChange={setText}
              richTextSeed={richTextSeed}
              onRichTextChange={setRichText}
              textAreaClassName={classes.textArea}
            />
          </div>

          {/* Photos */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>
              Фото ({photos.length})
            </Typography>
            {videos.length > 0 && photos.length > 0 ? (
              <Typography className={classes.sectionHint}>
                Первое фото — обложка видео
              </Typography>
            ) : null}
            <Action
              onClick={pickPhotos}
              disabled={isPending || !capabilities.privateContentUploads}
              title={
                !capabilities.privateContentUploads
                  ? uploadUnavailableMessage
                  : undefined
              }
              className={({ pressed }) =>
                [
                  classes.action2,
                  pressed ? classes.opacityState5 : classes.opacityState6,
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {uploading ? (
                <Spinner size="small" color={CREAM_BG} />
              ) : (
                <MaterialIcons
                  name="photo-library"
                  size={18}
                  color={CREAM_BG}
                />
              )}
              <Typography className={classes.uploadBtnText}>
                {uploading ? "Загрузка..." : "Выбрать из галереи"}
              </Typography>
            </Action>

            <PhotoEditor
              photos={photos.map(privatePhotos.preview)}
              onRemove={removePhoto}
              onMove={movePhoto}
              onReorder={reorderPhotos}
              onReplace={(i) => {
                void replacePhoto(i);
              }}
              replaceDisabled={isPending || !capabilities.privateContentUploads}
            />
          </div>

          {/* Videos */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>
              Видео ({videos.length})
            </Typography>
            <Action
              onClick={pickVideo}
              disabled={
                isPending ||
                !capabilities.privatePostVideoUploads ||
                !capabilities.privateContentUploads
              }
              title={
                !capabilities.privatePostVideoUploads ||
                !capabilities.privateContentUploads
                  ? uploadUnavailableMessage
                  : undefined
              }
              className={({ pressed }) =>
                [
                  classes.action3,
                  pressed ? classes.opacityState7 : classes.opacityState8,
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {mediaUploading ? (
                <Spinner size="small" color={CREAM_BG} />
              ) : (
                <MaterialIcons name="videocam" size={18} color={CREAM_BG} />
              )}
              <Typography className={classes.mediaBtnText}>
                {mediaUploading ? "Загрузка..." : "Выбрать видеофайл"}
              </Typography>
            </Action>
            <VkVideoField
              videos={videos}
              disabled={isPending || recovery.blocked}
              onAdd={addVideoUrl}
            />
            {videos.length > 0 && (
              <Typography className={classes.hint}>
                Видео добавлено — сохраните или опубликуйте пост
              </Typography>
            )}
            {videos.length > 0 && (
              <div
                className={["ui-stack ", classes.mediaList]
                  .filter(Boolean)
                  .join(" ")}
              >
                {videos.map((uri, i) => (
                  <div
                    key={`${uri}-${i}`}
                    className={["ui-stack ", classes.mediaItem]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <MaterialIcons name="videocam" size={16} color={ACCENT} />
                    <Typography lines={1} className={classes.mediaItemName}>
                      Видео {i + 1}
                    </Typography>
                    <VkVideoPreviewButton url={uri} index={i} />
                    <Action
                      disabled={isPending}
                      aria-label={`Удалить видео ${i + 1}`}
                      onClick={() => removeVideo(i)}
                      className={classes.mediaRemoveBtn}
                    >
                      <MaterialIcons name="close" size={14} color="#A85C5C" />
                    </Action>
                  </div>
                ))}
              </div>
            )}
          </div>

          <PostAttachmentsField
            attachments={mediaAttachments}
            uploadEnabled={capabilities.privatePostMediaUploads}
            disabled={isPending}
            onPick={pickAttachment}
            onRemove={removeMedia}
          />

          <PostEditorTags
            variant="quick"
            availableTags={availableTags}
            selectedTags={tags}
            onToggle={toggleTag}
          />
        </ScrollArea>
      </div>
    </Dialog>
  );
}
