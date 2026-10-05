"use client";
import classes from "./create-post-modal.module.scss";
import {
  Dialog,
  Action,
  Typography,
  Spinner,
  ScrollArea,
} from "@/shared/ui/elements";
import { useEffect, useRef, useState } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { trpc } from "@/shared/api/trpc";

import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { MAX_VIDEO_BYTES } from "@/shared/browser/file-operations";
import { requireUploadedUrl } from "@/shared/media/upload-result";
import { PostSaveCoordinator } from "@/domain/post/save-post";
import { usePostAttachments } from "./use-post-attachments";
import { PostAttachmentsField } from "./post-attachments-field";
import { uploadAdminVideoBlob } from "@/features/admin/media/video-upload";
import { fileToUpload, pickWebFiles } from "@/shared/media/image-upload";
import { PhotoEditor } from "@/features/admin/photo-editor";
import { ScheduleDatetime } from "@/features/admin/schedule-datetime";
import { tagsForTarget } from "@/domain/post/post-tags";
import {
  RichTextField,
  type RichTextFieldHandle,
} from "@/features/admin/rich-text-field";
import type { RichTextBlock } from "@/domain/content/types";
import { serializePostDraft } from "@/domain/post/draft";
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
  } | null;
}
export function CreatePostModal({
  visible,
  onClose,
  defaultTarget,
  editingPost,
}: CreatePostModalProps) {
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
  const notifyError = (message: string) => window.alert(message);
  const {
    attachments: mediaAttachments,
    removedIds: removedMediaIds,
    reset: resetAttachments,
    pick: pickAttachment,
    remove: removeMedia,
  } = usePostAttachments(operation, notifyError);
  const [richText, setRichText] = useState<RichTextBlock[] | undefined>();
  const [richTextSeed, setRichTextSeed] = useState<
    RichTextBlock[] | null | undefined
  >(null);
  const [draftKey, setDraftKey] = useState(0);
  const richTextFieldRef = useRef<RichTextFieldHandle>(null);
  const utils = trpc.useUtils();
  const saveCoordinator = useRef(
    new PostSaveCoordinator(editingPost?.id ?? null),
  );
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) {
      seeded.current = null;
      return;
    }
    const seedKey = `${editingPost?.id ?? "new"}:${defaultTarget}`;
    if (seeded.current === seedKey) return;
    seeded.current = seedKey;
    cancelOperation();
    saveCoordinator.current = new PostSaveCoordinator(editingPost?.id ?? null);
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
    setPublishedAt(
      Number.isNaN(initialDate.getTime()) ? new Date() : initialDate,
    );
    setRichTextSeed(editingPost?.richText ?? null);
    setRichText(editingPost?.richText ?? undefined);
    setVideos(
      editingPost?.media?.filter((m) => m.type === "video").map((m) => m.url) ??
        [],
    );
    resetAttachments(editingPost?.media);
  }, [visible, editingPost, defaultTarget, cancelOperation, resetAttachments]);
  const closeEditor = () => {
    operation.cancel();
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
  const handleClose = () => {
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
      (changed || operation.busy) &&
      !window.confirm(
        "Закрыть редактор? Несохранённые изменения будут потеряны.",
      )
    )
      return;
    closeEditor();
  };
  const addVideoUrl = (url: string) => {
    setVideos((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setTags((prev) => (prev.includes("video") ? prev : [...prev, "video"]));
  };
  const pickVideo = async () => {
    const task = operation.begin("video");
    if (!task) return;
    try {
      const files = await pickWebFiles("video/*", false, {
        signal: task.signal,
        maxBytes: MAX_VIDEO_BYTES,
      });
      if (!files.length) return;
      task.assertCurrent();
      const url = await uploadAdminVideoBlob(
        files[0],
        files[0].name || "video.mp4",
        task.signal,
      );
      task.assertCurrent();
      addVideoUrl(url);
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
  const replacePhoto = async (index: number) => {
    const task = operation.begin("photos");
    if (!task) return;
    const previous = photos[index];
    try {
      const files = await pickWebFiles("image/*", false, {
        signal: task.signal,
      });
      if (!files.length) return;
      const payload = await fileToUpload(files[0], { signal: task.signal });
      task.assertCurrent();
      const url = requireUploadedUrl(
        await utils.client.admin.uploadPhoto.mutate(payload, {
          signal: task.signal,
        }),
      );
      task.assertCurrent();
      setPhotos((prev) =>
        prev.map((photo, i) =>
          i === index && photo === previous ? url : photo,
        ),
      );
    } catch (error) {
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
      await saveCoordinator.current.save(
        payload,
        mediaAttachments,
        removedMediaIds,
        {
          create: (input, signal) =>
            utils.client.admin.createPost.mutate(input, { signal }),
          update: (id, input, signal) =>
            utils.client.admin.updatePost.mutate({ id, ...input }, { signal }),
          upload: (input, signal) =>
            utils.client.admin.uploadMedia.mutate(input, { signal }),
        },
        task,
      );
      task.assertCurrent();
      // Cache refresh is independent of a confirmed write and must not delay closing the editor.
      void utils.admin.posts.invalidate();
      void utils.admin.scheduledPosts.invalidate();
      void utils.feed.list.invalidate();
      void utils.feed.listPaginated.invalidate();
      void utils.club.list.invalidate();
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
    const task = operation.begin("photos");
    if (!task) return;
    let uploaded = 0;
    try {
      const files = await pickWebFiles("image/*,.heic,.heif", true, {
        signal: task.signal,
      });
      for (const file of files) {
        const payload = await fileToUpload(file, { signal: task.signal });
        task.assertCurrent();
        const url = requireUploadedUrl(
          await utils.client.admin.uploadPhoto.mutate(payload, {
            signal: task.signal,
          }),
        );
        task.assertCurrent();
        setPhotos((prev) => [...prev, url]);
        uploaded++;
      }
    } catch (error) {
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
    if (operation.busy) return;
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };
  const movePhoto = (fromIndex: number, direction: "left" | "right") => {
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
  const toggleTag = (slug: string) => {
    setTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );
  };
  const availableTags = tagsForTarget(target);
  const isPending = operation.busy;
  if (!visible) return null;
  return (
    <Dialog
      label="Редактор публикации"
      open
      motion="slide"
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
            className={({ pressed }) =>
              pressed ? classes.opacityState : classes.opacityState2
            }
          >
            <MaterialIcons name="close" size={24} color={BROWN_DARK} />
          </Action>
          <Typography className={classes.headerTitle}>
            {editingPost ? "Редактировать" : "Новый пост"}
          </Typography>
          <Action
            onClick={handleSubmit}
            disabled={isPending}
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

        <ScrollArea
          inert={operation.busy}
          className={classes.scroll}
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
              disabled={isPending}
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
              photos={photos}
              onRemove={removePhoto}
              onMove={movePhoto}
              onReorder={reorderPhotos}
              onReplace={(i) => {
                void replacePhoto(i);
              }}
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
              disabled={isPending}
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
            {videos.length > 0 && (
              <Typography className={classes.hint}>
                Видео загружено — нажмите «Опубликовать»
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
                    <Action
                      aria-label={`Удалить видео ${i + 1}`}
                      onClick={() =>
                        setVideos((prev) => prev.filter((_, idx) => idx !== i))
                      }
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
            disabled={isPending}
            onPick={pickAttachment}
            onRemove={removeMedia}
          />

          {/* Tags */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>Метки</Typography>
            <div
              className={["ui-stack ", classes.tagsGrid]
                .filter(Boolean)
                .join(" ")}
            >
              {availableTags.map((tag) => {
                const isSelected = tags.includes(tag.slug);
                return (
                  <Action
                    key={tag.slug}
                    onClick={() => toggleTag(tag.slug)}
                    className={[
                      classes.tagChipRubricSelected,
                      tag.rubric && isSelected
                        ? classes.appearanceState5
                        : isSelected
                          ? classes.appearanceState6
                          : tag.rubric
                            ? classes.appearanceState7
                            : classes.appearanceState8,
                      tag.rubric
                        ? classes.borderWidthState
                        : classes.borderWidthState2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography
                      className={[
                        tag.rubric
                          ? classes.appearanceState9
                          : classes.appearanceState10,
                        isSelected ? classes.colorState5 : classes.colorState6,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {tag.label}
                    </Typography>
                  </Action>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
    </Dialog>
  );
}
