"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getAdminScreenLayout } from "./admin-screen.layout";
import classes from "./admin-screen.module.scss";
import {
  Typography,
  Action,
  Dialog,
  ScrollArea,
  Spinner,
  Field,
} from "@/shared/ui/elements";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";

import { trpc } from "@/shared/api/trpc";
import {
  requirePrivateUpload,
  useCapabilities,
  uploadUnavailableMessage,
} from "@/shared/api/capabilities";
import type { AdminPost } from "@/shared/api/types";

import { ScheduleDatetime } from "@/features/admin/schedule-datetime";

import { pickWebFiles } from "@/shared/media/image-upload";
import { PhotoEditor } from "@/features/admin/photo-editor";
import {
  RichTextField,
  type RichTextFieldHandle,
} from "@/features/admin/rich-text-field";
import { RichTextRenderer } from "@/domain/content/rich-text-renderer";
import type { RichTextBlock } from "@/domain/content/types";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
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
  PostAttachmentsField,
  PostAttachmentsList,
} from "./post-attachments-field";
import { MAX_VIDEO_BYTES } from "@/shared/browser/file-operations";
import { serializePostDraft, postDraftSnapshot } from "@/domain/post/draft";
import {
  CREAM_BG,
  BROWN_DARK,
  BROWN_LIGHT,
  GREEN_ACCENT,
  ALL_TAGS,
  EMPTY_FORM,
} from "./admin-screen.content";
import type { PostFormData } from "./admin-screen.content";

function formForPost(post: AdminPost): PostFormData {
  return {
    text: post.text,
    photos: post.photos as string[],
    videos: Array.isArray(post.media)
      ? post.media
          .filter((item) => item?.type === "video" && item?.url)
          .map((item) => item.url)
      : [],
    tags: post.tags as string[],
    published: post.published,
    status:
      post.status === "scheduled" || post.status === "draft"
        ? post.status
        : "published",
    scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
    publishedAt: post.publishedAt
      ? new Date(post.publishedAt)
      : post.createdAt
        ? new Date(post.createdAt)
        : new Date(),
    sortOrder: post.sortOrder,
    target:
      post.target === "club" || post.target === "both" ? post.target : "feed",
  };
}

type AdminPostEditorProps = {
  post: AdminPost | null;
  scheduledDate: Date | null;
  onClose: () => void;
  onSaved: () => void;
};

/** A different account must never inherit the previous editor's File/coordinator state. */
export function AdminPostEditor(props: AdminPostEditorProps) {
  const { user } = useAuth();
  return (
    <AdminPostEditorBody
      key={`${user?.id ?? "guest"}:${props.post?.id ?? "new"}`}
      {...props}
    />
  );
}

/** Own the editor state so typing never renders the admin lists or tabs. */
function AdminPostEditorBody({
  post,
  scheduledDate,
  onClose,
  onSaved,
}: AdminPostEditorProps) {
  const viewport = useViewport();
  const capabilities = useCapabilities();
  const { stylesLayout } = getAdminScreenLayout(viewport);
  const [showForm, setShowForm] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(post?.id ?? null);
  const [form, setForm] = useState<PostFormData>(() =>
    post
      ? formForPost(post)
      : scheduledDate
        ? {
            ...EMPTY_FORM,
            status: "scheduled",
            published: false,
            scheduledAt: scheduledDate,
            target: "club",
          }
        : EMPTY_FORM,
  );
  const operation = useSessionOperation(showForm, editingId);
  const videoUploading = operation.kind === "video";
  const uploading = operation.kind === "photos";
  const saving = operation.kind === "save";
  const [coordinator] = useState(
    () =>
      new PostSaveCoordinator(
        post?.id ?? null,
        post
          ? postDraftSnapshot({ ...formForPost(post), richText: post.richText })
          : undefined,
        post ? readEditRevision(post) : undefined,
      ),
  );
  const saveCoordinator = useRef(coordinator);
  const uploadSelection = usePostUploadSelection();
  const [showPreview, setShowPreview] = useState(false);
  const [richText, setRichText] = useState<RichTextBlock[] | undefined>(
    post?.richText ?? undefined,
  );
  const [richTextSeed, setRichTextSeed] = useState<
    RichTextBlock[] | null | undefined
  >(post?.richText ?? null);
  const [draftKey, setDraftKey] = useState(0);
  const richTextFieldRef = useRef<RichTextFieldHandle>(null);
  const utils = trpc.useUtils();
  const invalidatePublicFeeds = onSaved;
  const notifyAdminError = (message: string) => {
    {
      window.alert(message);
      return;
    }
  };
  const attachments = usePostAttachments(operation, notifyAdminError);
  const privatePhotos = usePrivatePostPhotos(showForm, editingId ?? "new");
  const privateVideos = usePrivatePostVideos(showForm, editingId ?? "new");
  const editorSnapshot = useMemo(
    () => ({
      draft: { ...form, richText: richText ?? null },
      attachments: attachments.attachments,
      removedIds: attachments.removedIds,
      pending: uploadSelection.pending,
      privatePhotos: privatePhotos.photos,
      privateVideos: privateVideos.videos,
    }),
    [
      form,
      richText,
      attachments.attachments,
      attachments.removedIds,
      uploadSelection.pending,
      privatePhotos.photos,
      privateVideos.videos,
    ],
  );
  const recovery = usePostRecovery({
    active: showForm,
    slot: `full:${editingId ?? "new"}`,
    editor: editorSnapshot,
    coordinator: saveCoordinator,
    onRestore: (snapshot) => {
      privatePhotos.restore(
        snapshot.privatePhotos ?? [],
        snapshot.draft.photos,
      );
      privateVideos.restore(
        snapshot.privateVideos ?? [],
        snapshot.draft.videos,
      );
      setForm({
        ...snapshot.draft,
        published: snapshot.draft.status === "published",
      });
      setRichText(snapshot.draft.richText ?? undefined);
      setRichTextSeed(snapshot.draft.richText ?? null);
      setDraftKey((key) => key + 1);
      attachments.restore(snapshot.attachments, snapshot.removedIds);
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
  const resetAttachments = attachments.reset;
  useEffect(() => {
    resetAttachments(post?.media);
  }, [post, resetAttachments]);
  const resetForm = () => {
    privatePhotos.reset();
    privateVideos.reset();
    operation.cancel();
    uploadSelection.reset();
    saveCoordinator.current = new PostSaveCoordinator();
    setForm(EMPTY_FORM);
    attachments.reset();
    setShowPreview(false);
    setEditingId(null);
    setShowForm(false);
    onClose();
    setRichText(undefined);
    setRichTextSeed(null);
    setDraftKey((key) => key + 1);
  };
  const handleSubmit = async () => {
    if (recovery.blocked) return;
    if (post && !Array.isArray(post.media)) {
      notifyAdminError(
        "Не удалось загрузить вложения поста. Изменения оставлены в редакторе. Дождитесь сохранения черновика на этом устройстве и обновите страницу.",
      );
      return;
    }
    if (
      !form.text.trim() &&
      !form.photos.length &&
      !form.videos.length &&
      !attachments.attachments.length
    ) {
      notifyAdminError("Добавьте текст, фото, видео, аудио или документ");
      return;
    }
    if (
      form.status === "scheduled" &&
      (!form.scheduledAt || Number.isNaN(form.scheduledAt.getTime()))
    ) {
      notifyAdminError("Выберите дату и время публикации");
      return;
    }
    if (
      form.status !== "scheduled" &&
      Number.isNaN(form.publishedAt.getTime())
    ) {
      notifyAdminError("Выберите дату публикации");
      return;
    }
    const task = operation.begin("save");
    if (!task) return;
    try {
      uploadSelection.assertReady();
      await recovery.checkpoint();
      task.assertCurrent();
      const payload = serializePostDraft({
        ...form,
        richText:
          richTextFieldRef.current?.getRichTextBlocksForSubmit() ??
          richTextFieldRef.current?.getRichTextBlocks() ??
          richText ??
          null,
      });
      await saveCoordinator.current.save(
        payload,
        attachments.attachments,
        attachments.removedIds,
        postApi,
        task,
        privatePhotos.photos,
        privateVideos.videos,
      );
      task.assertCurrent();
      await recovery.clear();
      task.assertCurrent();
      invalidatePublicFeeds();
      resetForm();
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        notifyAdminError(
          error instanceof Error ? error.message : "Не удалось сохранить пост",
        );
    } finally {
      task.finish();
    }
  };
  const addVideoUrl = (url: string) => {
    setForm((prev) => ({
      ...prev,
      videos: prev.videos.includes(url) ? prev.videos : [...prev.videos, url],
      tags: prev.tags.includes("video") ? prev.tags : [...prev.tags, "video"],
    }));
  };
  const pickVideo = async () => {
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
      const reference = await privateVideos.add(files[0], task, true);
      task.assertCurrent();
      addVideoUrl(reference);
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        notifyAdminError(
          error instanceof Error ? error.message : "Не удалось загрузить видео",
        );
    } finally {
      task.finish();
    }
  };
  const removeVideo = (index: number) => {
    if (operation.busy || recovery.blocked) return;
    const reference = form.videos[index];
    if (!reference) return;
    privateVideos.remove(reference);
    const existing = post?.media?.find(
      (item) =>
        item.type === "video" &&
        item.url === reference &&
        reference === `/api/media/post-attachments/${item.id}`,
    );
    if (existing) attachments.markRemoved(existing.id);
    setForm((prev) => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  };
  const previewPhotos = [
    ...form.photos.map(privatePhotos.preview),
    ...form.videos.flatMap((reference) => {
      const poster =
        privateVideos.poster(reference) ??
        post?.media?.find(
          (item) => item.type === "video" && item.url === reference,
        )?.posterUrl;
      return poster ? [poster] : [];
    }),
  ];
  const pickPhotosFromGallery = async () => {
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
        setForm((prev) => ({ ...prev, photos: [...prev.photos, url] }));
        uploaded++;
      }
    } catch (error) {
      if (task.isCurrent()) uploadSelection.failed(selected, error);
      checkOperationAccessError(error);
      if (task.isCurrent())
        notifyAdminError(
          `${error instanceof Error ? error.message : "Не удалось загрузить фото"}${uploaded ? `\nУже добавлено фото: ${uploaded}.` : ""}`,
        );
    } finally {
      task.finish();
    }
  };
  const removePhoto = (index: number) => {
    if (operation.busy) return;
    privatePhotos.removePreview(form.photos[index]);
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };
  const movePhoto = (fromIndex: number, direction: "up" | "down") => {
    if (operation.busy) return;
    setForm((prev) => {
      const newPhotos = [...prev.photos];
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= newPhotos.length) return prev;
      [newPhotos[fromIndex], newPhotos[toIndex]] = [
        newPhotos[toIndex],
        newPhotos[fromIndex],
      ];
      return { ...prev, photos: newPhotos };
    });
  };
  const reorderPhotos = (fromIndex: number, toIndex: number) => {
    setForm((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.photos.length || toIndex >= prev.photos.length)
        return prev;
      const photos = [...prev.photos];
      const [item] = photos.splice(fromIndex, 1);
      photos.splice(toIndex, 0, item);
      return { ...prev, photos };
    });
  };
  const toggleTag = useCallback((slug: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(slug)
        ? prev.tags.filter((t) => t !== slug)
        : [...prev.tags, slug],
    }));
  }, []);
  const discardRecovery = async () => {
    if (
      !window.confirm(
        "Удалить локальную копию? Если сохранение или загрузка не подтверждены, сначала проверьте список публикаций в другой вкладке. Файлы на сервере не удаляются.",
      )
    )
      return;
    try {
      await recovery.clear();
      resetForm();
    } catch (error) {
      notifyAdminError((error as Error).message);
    }
  };
  const finishRecovery = async () => {
    try {
      await recovery.clear();
      invalidatePublicFeeds();
      resetForm();
    } catch (error) {
      notifyAdminError((error as Error).message);
    }
  };
  const recoverCreation = async () => {
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
      invalidatePublicFeeds();
      resetForm();
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) notifyAdminError((error as Error).message);
    } finally {
      task.finish();
    }
  };
  const closeForm = async () => {
    if (recovery.status === "loading" || recovery.status === "offered") {
      resetForm();
      return;
    }
    try {
      saveCoordinator.current.assertCanClose();
    } catch (error) {
      notifyAdminError((error as Error).message);
      return;
    }
    if (
      (form.text.trim() ||
        form.photos.length ||
        form.videos.length ||
        attachments.attachments.length ||
        attachments.removedIds.length ||
        uploadSelection.pending.length ||
        operation.busy) &&
      !window.confirm(
        "Закрыть редактор? Несохранённые изменения будут потеряны.",
      )
    )
      return;
    try {
      await recovery.clear();
      resetForm();
    } catch (error) {
      notifyAdminError((error as Error).message);
    }
  };
  // ── Form Modal ──
  const renderForm = () => {
    if (!showForm) return null;
    return (
      <Dialog
        label="Редактор публикации"
        open
        motion="fade"
        className={classes.editorDialog}
        onClose={closeForm}
      >
        <div
          className={["ui-stack ", classes.modalContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.modalHeader]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={closeForm}
              aria-label="Закрыть редактор"
              className={({ pressed }) =>
                pressed ? classes.opacityState5 : classes.opacityState6
              }
            >
              <MaterialIcons name="close" size={24} color={BROWN_DARK} />
            </Action>
            <Typography className={classes.modalTitle}>
              {editingId ? "Редактировать пост" : "Новый пост"}
            </Typography>
            <Action
              onClick={handleSubmit}
              disabled={operation.busy || recovery.blocked}
              className={({ pressed }) =>
                [
                  classes.action2,
                  pressed || videoUploading || uploading
                    ? classes.opacityState7
                    : classes.opacityState8,
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <Typography className={classes.submitBtnText}>
                {videoUploading ? "Видео..." : saving ? "..." : "Сохранить"}
              </Typography>
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
          {/* Preview/Edit toggle */}
          <PostUploadStatus selection={uploadSelection} busy={operation.busy} />
          <div
            className={["ui-stack ", classes.previewToggleRow]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={() => setShowPreview(false)}
              className={[
                classes.previewToggleBtnActive,
                !showPreview ? classes.backgroundColorState3 : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="edit"
                size={16}
                color={!showPreview ? CREAM_BG : BROWN_LIGHT}
              />
              <Typography
                className={[
                  classes.previewToggleTextActive,
                  !showPreview ? classes.colorState3 : classes.colorState4,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Редактор
              </Typography>
            </Action>
            <Action
              onClick={() => setShowPreview(true)}
              className={[
                classes.previewToggleBtnActive,
                showPreview ? classes.backgroundColorState4 : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="visibility"
                size={16}
                color={showPreview ? CREAM_BG : BROWN_LIGHT}
              />
              <Typography
                className={[
                  classes.previewToggleTextActive,
                  showPreview ? classes.colorState5 : classes.colorState6,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Предпросмотр
              </Typography>
            </Action>
          </div>

          {showPreview ? (
            <ScrollArea
              key="preview"
              className={classes.formScroll}
              contentClassName={classes.previewContent}
            >
              {/* Preview: how post will look in feed */}
              <div
                className={["ui-stack ", classes.previewCard]
                  .filter(Boolean)
                  .join(" ")}
              >
                {previewPhotos.length > 0 && (
                  <div
                    className={["ui-stack ", classes.previewPhotos]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {previewPhotos.length === 1 ? (
                      <Picture
                        source={{ uri: previewPhotos[0] }}
                        contentFit="contain"
                        className={classes.previewSinglePhoto}
                      />
                    ) : (
                      <ScrollArea horizontal paging hideScrollbar>
                        {previewPhotos.map((uri, i) => (
                          <Picture
                            key={i}
                            source={{ uri }}
                            style={{
                              width: stylesLayout.previewCarouselPhoto.width,
                            }}
                            contentFit="contain"
                            className={classes.previewCarouselPhoto}
                          />
                        ))}
                      </ScrollArea>
                    )}
                  </div>
                )}
                {form.videos.length > 0 && (
                  <div
                    className={["ui-stack ", classes.previewVideoNote]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <MaterialIcons
                      name="videocam"
                      size={18}
                      color={GREEN_ACCENT}
                    />
                    <Typography className={classes.previewVideoNoteText}>
                      {form.videos.length === 1
                        ? "Видео будет в ленте"
                        : `В ленте будет ${form.videos.length} видео`}
                    </Typography>
                  </div>
                )}
                <PostAttachmentsList attachments={attachments.attachments} />
                {form.text.trim() ? (
                  <div
                    className={["ui-stack ", classes.previewTextContainer]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {richText?.length ? (
                      <RichTextRenderer
                        richText={richText}
                        plainText={form.text}
                      />
                    ) : (
                      <Typography lines={0} className={classes.previewPostText}>
                        {form.text}
                      </Typography>
                    )}
                  </div>
                ) : null}
                {form.tags.length > 0 && (
                  <div
                    className={["ui-stack ", classes.previewTagsRow]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {form.tags.map((slug) => {
                      const tag = ALL_TAGS.find((t) => t.slug === slug);
                      return (
                        <div
                          key={slug}
                          className={["ui-stack ", classes.previewTag]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <Typography className={classes.postItemDate}>
                            {tag?.label || slug}
                          </Typography>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div
                  className={["ui-stack ", classes.previewFooter]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.previewDate}>
                    Сегодня
                  </Typography>
                  <div
                    className={["ui-stack ", classes.previewActions]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <MaterialIcons
                      name="favorite-border"
                      size={20}
                      color={BROWN_LIGHT}
                    />
                    <MaterialIcons
                      name="bookmark-border"
                      size={20}
                      color={BROWN_LIGHT}
                    />
                  </div>
                </div>
              </div>
              <Typography className={classes.previewHint}>
                Так пост будет выглядеть в ленте
              </Typography>
            </ScrollArea>
          ) : null}
          <ScrollArea
            inert={showPreview}
            contentInert={operation.busy || recovery.blocked || showPreview}
            key="editor"
            contentClassName={classes.formContent}
            className={[
              classes.formScroll,
              recovery.status === "loading" ? classes.formLoading : "",
              showPreview ? classes.positionState : "",
              showPreview ? classes.widthState : "",
              showPreview ? classes.heightState : "",
              showPreview ? classes.leftState : "",
              showPreview ? classes.opacityState9 : "",
              showPreview ? classes.overflowState : "",
              showPreview
                ? classes.pointerEventsState
                : classes.pointerEventsState2,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {/* Text */}
            <div
              className={["ui-stack ", classes.formGroup]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.formLabel}>Текст поста</Typography>
              <RichTextField
                ref={richTextFieldRef}
                key={`${editingId ?? "new"}:${draftKey}`}
                value={form.text}
                onValueChange={(text) => setForm((prev) => ({ ...prev, text }))}
                richTextSeed={richTextSeed}
                onRichTextChange={setRichText}
                textAreaClassName={classes.textArea}
              />
            </div>

            {/* Photos */}
            <div
              className={["ui-stack ", classes.formGroup]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.formLabel}>
                Фотографии ({form.photos.length})
              </Typography>
              {/* Upload from gallery button */}
              <Action
                onClick={pickPhotosFromGallery}
                disabled={operation.busy || !capabilities.privateContentUploads}
                title={
                  !capabilities.privateContentUploads
                    ? uploadUnavailableMessage
                    : undefined
                }
                className={({ pressed }) =>
                  [
                    classes.action3,
                    pressed ? classes.opacityState10 : classes.opacityState11,
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
                <Typography className={classes.galleryBtnText}>
                  {uploading ? "Загрузка..." : "Выбрать из галереи"}
                </Typography>
              </Action>
              <PhotoEditor
                photos={form.photos.map(privatePhotos.preview)}
                onRemove={removePhoto}
                onMove={(index, direction) =>
                  movePhoto(index, direction === "left" ? "up" : "down")
                }
                onReorder={reorderPhotos}
              />
            </div>

            {/* Videos */}
            <div
              className={["ui-stack ", classes.formGroup]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.formLabel}>
                Видео ({form.videos.length})
              </Typography>
              <Action
                onClick={pickVideo}
                disabled={
                  operation.busy ||
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
                    classes.action4,
                    pressed ? classes.opacityState12 : classes.opacityState13,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                {videoUploading ? (
                  <Spinner size="small" color={CREAM_BG} />
                ) : (
                  <MaterialIcons name="videocam" size={18} color={CREAM_BG} />
                )}
                <Typography className={classes.galleryBtnText}>
                  {videoUploading ? "Загрузка видео..." : "Выбрать видеофайл"}
                </Typography>
              </Action>
              <VkVideoField
                videos={form.videos}
                disabled={operation.busy || recovery.blocked}
                onAdd={(url) =>
                  setForm((previous) => ({
                    ...previous,
                    videos: [...previous.videos, url],
                    tags: previous.tags.includes("video")
                      ? previous.tags
                      : [...previous.tags, "video"],
                  }))
                }
              />
              {form.videos.length > 0 && (
                <div
                  className={["ui-stack ", classes.videoList]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {form.videos.map((uri, i) => (
                    <div
                      key={`${uri}-${i}`}
                      className={["ui-stack ", classes.videoItem]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <MaterialIcons
                        name="videocam"
                        size={16}
                        color={GREEN_ACCENT}
                      />
                      <Typography lines={1} className={classes.videoItemName}>
                        Видео {i + 1}
                      </Typography>
                      <VkVideoPreviewButton url={uri} index={i} />
                      <Action
                        disabled={operation.busy}
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
              attachments={attachments.attachments}
              uploadEnabled={capabilities.privatePostMediaUploads}
              disabled={operation.busy}
              onPick={attachments.pick}
              onRemove={attachments.remove}
            />

            <PostEditorTags
              variant="full"
              availableTags={ALL_TAGS}
              selectedTags={form.tags}
              onToggle={toggleTag}
            />

            {/* Where to publish */}
            <div
              className={["ui-stack ", classes.formGroup]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.formLabel}>
                Куда публиковать
              </Typography>
              <div
                className={["ui-stack ", classes.tagsGrid]
                  .filter(Boolean)
                  .join(" ")}
              >
                {(
                  [
                    { id: "feed", label: "Лента" },
                    { id: "club", label: "Клуб" },
                    { id: "both", label: "Лента и клуб" },
                  ] as const
                ).map((item) => (
                  <Action
                    key={item.id}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, target: item.id }))
                    }
                    className={[
                      classes.targetChipActive,
                      form.target === item.id
                        ? classes.backgroundColorState5
                        : classes.backgroundColorState6,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography
                      className={[
                        classes.targetChipTextActive,
                        form.target === item.id
                          ? classes.colorState9
                          : classes.colorState10,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {item.label}
                    </Typography>
                  </Action>
                ))}
              </div>
            </div>

            {/* Status */}
            <div
              className={["ui-stack ", classes.formGroup]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.formLabel}>Публикация</Typography>
              <div
                className={["ui-stack ", classes.tagsGrid]
                  .filter(Boolean)
                  .join(" ")}
              >
                {(
                  [
                    { id: "published", label: "Сейчас" },
                    { id: "scheduled", label: "Отложить" },
                    { id: "draft", label: "Черновик" },
                  ] as const
                ).map((item) => (
                  <Action
                    key={item.id}
                    onClick={() => {
                      setForm((prev) => {
                        const next = {
                          ...prev,
                          status: item.id,
                          published: item.id === "published",
                        };
                        if (item.id === "scheduled" && !prev.scheduledAt) {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          tomorrow.setHours(10, 0, 0, 0);
                          next.scheduledAt = tomorrow;
                        }
                        return next;
                      });
                    }}
                    className={[
                      classes.targetChipActive,
                      form.status === item.id
                        ? classes.backgroundColorState7
                        : classes.backgroundColorState8,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography
                      className={[
                        classes.targetChipTextActive,
                        form.status === item.id
                          ? classes.colorState11
                          : classes.colorState12,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {item.label}
                    </Typography>
                  </Action>
                ))}
              </div>
              {form.status === "scheduled" ? (
                <div
                  className={["ui-stack ", classes.div]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.formHint}>
                    Пост выйдет сам в выбранное время
                  </Typography>
                  <ScheduleDatetime
                    value={form.scheduledAt}
                    onChange={(date) =>
                      setForm((prev) => ({ ...prev, scheduledAt: date }))
                    }
                  />
                </div>
              ) : null}
              {form.status !== "scheduled" ? (
                <div
                  className={["ui-stack ", classes.div]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.formHint}>
                    Дата в ленте и клубе (можно прошлую)
                  </Typography>
                  <ScheduleDatetime
                    value={form.publishedAt}
                    onChange={(date) =>
                      setForm((prev) => ({ ...prev, publishedAt: date }))
                    }
                    allowPast
                  />
                </div>
              ) : null}
            </div>

            {/* Sort order */}
            <div
              className={["ui-stack ", classes.formGroup]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.formLabel}>
                Порядок сортировки
              </Typography>
              <Field
                value={form.sortOrder.toString()}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    sortOrder: parseInt(val) || 0,
                  }))
                }
                inputMode="numeric"
                placeholder="0"
                placeholderColor={BROWN_LIGHT}
                className={classes.sortInput}
              />
              <Typography className={classes.formHint}>
                Чем меньше число, тем выше пост в Ленте и админском списке. В
                Клубе публикации идут по дате публикации — от новых к старым.
              </Typography>
            </div>
          </ScrollArea>
        </div>
      </Dialog>
    );
  };
  return renderForm();
}
