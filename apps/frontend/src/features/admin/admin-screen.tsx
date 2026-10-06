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
  Collection,
} from "@/shared/ui/elements";
import { useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { trpc } from "@/shared/api/trpc";
import type { AdminPost } from "@/shared/api/types";
import { useRouter } from "@/shared/navigation/router";

import { CalendarTracker } from "@/features/admin/calendar-tracker";
import { StatsDashboard } from "@/features/admin/stats-dashboard";
import { ScheduleDatetime } from "@/features/admin/schedule-datetime";
import { ArticlesAdmin } from "@/features/admin/articles-admin";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";
import { uploadAdminVideoBlob } from "@/features/admin/media/video-upload";
import {
  blobToBase64,
  fileToUpload,
  pickWebFiles,
} from "@/shared/media/image-upload";
import { mediaBasename } from "@/domain/post/post-media-photos";
import { extractVideoPosterBlob } from "@/shared/media/video-poster";
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
import { usePostAttachments } from "./use-post-attachments";
import { usePostUploadSelection } from "./use-post-upload-selection";
import { PostUploadStatus } from "./post-upload-status";
import {
  PostAttachmentsField,
  PostAttachmentsList,
} from "./post-attachments-field";
import { requireUploadedUrl } from "@/shared/media/upload-result";
import { MAX_VIDEO_BYTES } from "@/shared/browser/file-operations";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
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
export default function AdminScreen() {
  const viewport = useViewport();
  const { stylesLayout } = getAdminScreenLayout(viewport);

  const router = useRouter();
  const {
    isOwner,
    isAuthenticated,
    loading: authLoading,
    error: sessionError,
  } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PostFormData>(EMPTY_FORM);
  const operation = useSessionOperation(showForm, editingId);
  const videoUploading = operation.kind === "video";
  const uploading = operation.kind === "photos";
  const saving = operation.kind === "save";
  const saveCoordinator = useRef(new PostSaveCoordinator());
  const uploadSelection = usePostUploadSelection();
  const [showPreview, setShowPreview] = useState(false);
  const [richText, setRichText] = useState<RichTextBlock[] | undefined>();
  const [richTextSeed, setRichTextSeed] = useState<
    RichTextBlock[] | null | undefined
  >(null);
  const [draftKey, setDraftKey] = useState(0);
  const richTextFieldRef = useRef<RichTextFieldHandle>(null);
  const [viewTab, setViewTab] = useState<
    | "posts"
    | "calendar"
    | "stats"
    | "members"
    | "payments"
    | "articles"
    | "reports"
  >("posts");
  // Fetch all posts (admin)
  const postsQuery = trpc.admin.posts.useQuery(undefined, { enabled: isOwner });
  const { data: posts, isLoading, refetch } = postsQuery;
  const utils = trpc.useUtils();
  const invalidatePublicFeeds = () => {
    void refetch();
    void utils.feed.list.invalidate();
    void utils.feed.listPaginated.invalidate();
    void utils.club.list.invalidate();
  };
  const notifyAdminError = (message: string) => {
    {
      window.alert(message);
      return;
    }
  };
  const attachments = usePostAttachments(operation, notifyAdminError);
  // Mutations
  const deleteMutation = trpc.admin.deletePost.useMutation({
    onSuccess: () => invalidatePublicFeeds(),
    onError: (err) =>
      notifyAdminError(err.message || "Не удалось удалить пост"),
  });
  const membersQuery = trpc.admin.members.useQuery(undefined, {
    enabled: isOwner && (viewTab === "members" || viewTab === "payments"),
  });
  const paymentsQuery = trpc.admin.payments.useQuery(undefined, {
    enabled: isOwner && viewTab === "payments",
  });
  const grantClub = trpc.admin.grantClub.useMutation({
    onSuccess: (result) => {
      void membersQuery.refetch();
      void paymentsQuery.refetch();
      const until = result?.expiresAt
        ? new Date(result.expiresAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "";
      {
        window.alert(until ? `Клуб продлён до ${until}` : "Клуб продлён");
        return;
      }
    },
    onError: (err) =>
      notifyAdminError(err.message || "Не удалось продлить клуб"),
  });
  const blockUser = trpc.moderation.blockUser.useMutation({
    onSuccess: () => void membersQuery.refetch(),
    onError: (err) =>
      notifyAdminError(err.message || "Не удалось заблокировать"),
  });
  const unblockUser = trpc.moderation.unblockUser.useMutation({
    onSuccess: () => void membersQuery.refetch(),
    onError: (err) =>
      notifyAdminError(err.message || "Не удалось разблокировать"),
  });
  const reportsQuery = trpc.moderation.listCommentReports.useQuery(undefined, {
    enabled: isOwner && viewTab === "reports",
  });
  const selectedListQuery =
    viewTab === "posts"
      ? postsQuery
      : viewTab === "members"
        ? membersQuery
        : viewTab === "payments"
          ? paymentsQuery
          : viewTab === "reports"
            ? reportsQuery
            : null;
  const dismissReport = trpc.moderation.dismissCommentReport.useMutation({
    onSuccess: () => void reportsQuery.refetch(),
    onError: (err) =>
      notifyAdminError(err.message || "Не удалось закрыть жалобу"),
  });
  const deleteReportedComment =
    trpc.moderation.deleteReportedComment.useMutation({
      onSuccess: () => void reportsQuery.refetch(),
      onError: (err) =>
        notifyAdminError(err.message || "Не удалось удалить комментарий"),
    });
  const resetForm = () => {
    operation.cancel();
    uploadSelection.reset();
    saveCoordinator.current = new PostSaveCoordinator();
    setForm(EMPTY_FORM);
    attachments.reset();
    setShowPreview(false);
    setEditingId(null);
    setShowForm(false);
    setRichText(undefined);
    setRichTextSeed(null);
    setDraftKey((key) => key + 1);
  };
  const handleCreate = () => {
    operation.cancel();
    uploadSelection.reset();
    saveCoordinator.current = new PostSaveCoordinator();
    setEditingId(null);
    setForm(EMPTY_FORM);
    attachments.reset();
    setRichText(undefined);
    setRichTextSeed(null);
    setDraftKey((key) => key + 1);
    setShowForm(true);
  };
  const handleEdit = (post: AdminPost) => {
    operation.cancel();
    uploadSelection.reset();
    attachments.reset(post.media);
    setEditingId(post.id);
    setRichTextSeed(post.richText ?? null);
    setRichText(post.richText ?? undefined);
    const initialForm: PostFormData = {
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
    saveCoordinator.current = new PostSaveCoordinator(
      post.id,
      postDraftSnapshot({ ...initialForm, richText: post.richText }),
    );
    setForm(initialForm);
    setShowForm(true);
  };
  const handleDelete = (id: number) => {
    {
      if (confirm("Удалить этот пост?")) {
        deleteMutation.mutate({ id });
      }
    }
  };
  const handleGrantClub = (userId: number, label: string) => {
    const message = `Выдать клуб на 31 день: ${label}?`;
    {
      if (confirm(message)) grantClub.mutate({ userId });
      return;
    }
  };
  const formatAdminDate = (value: Date | string | null | undefined) => {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  const handleSubmit = async () => {
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
  const addVideoUrl = (url: string, posterUrl?: string) => {
    setForm((prev) => ({
      ...prev,
      videos: prev.videos.includes(url) ? prev.videos : [...prev.videos, url],
      tags: prev.tags.includes("video") ? prev.tags : [...prev.tags, "video"],
      photos:
        posterUrl && !prev.photos.includes(posterUrl)
          ? [...prev.photos, posterUrl]
          : prev.photos,
    }));
  };
  const uploadVideoPoster = async (
    videoUrl: string,
    source: Blob,
    task: ScopedOperation,
  ): Promise<string | null> => {
    const posterBlob = await extractVideoPosterBlob(source, task.signal);
    if (!posterBlob) return null;
    const videoBase = mediaBasename(videoUrl).replace(/\.[^.]+$/, "");
    const base64 = await blobToBase64(posterBlob, task.signal);
    task.assertCurrent();
    return requireUploadedUrl(
      await utils.client.admin.uploadPhoto.mutate(
        { base64, filename: `${videoBase}_thumb.jpg`, mimeType: "image/jpeg" },
        { signal: task.signal },
      ),
    );
  };
  const pickVideo = async () => {
    const task = operation.begin("video");
    if (!task) return;
    let selected: number | undefined;
    try {
      uploadSelection.assertReady();
      const files = await pickWebFiles("video/*", false, {
        signal: task.signal,
        maxBytes: MAX_VIDEO_BYTES,
      });
      if (!files.length) return;
      task.assertCurrent();
      [selected] = uploadSelection.select(files);
      uploadSelection.sending(selected);
      const file = files[0];
      const url = await uploadAdminVideoBlob(
        file,
        file.name || "video.mp4",
        task.signal,
      );
      task.assertCurrent();
      uploadSelection.confirmed(selected);
      // Keep the confirmed video even if preparing its optional cover fails.
      addVideoUrl(url);
      const posterUrl = await uploadVideoPoster(url, file, task);
      task.assertCurrent();
      if (posterUrl) addVideoUrl(url, posterUrl);
    } catch (error) {
      if (task.isCurrent()) uploadSelection.failed(selected, error);
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
    if (operation.busy) return;
    setForm((prev) => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  };
  const pickPhotosFromGallery = async () => {
    const task = operation.begin("photos");
    if (!task) return;
    let uploaded = 0;
    let selected: number | undefined;
    try {
      uploadSelection.assertReady();
      const files = await pickWebFiles("image/*,.heic,.heif", true, {
        signal: task.signal,
      });
      task.assertCurrent();
      const selections = uploadSelection.select(files);
      for (const [index, file] of files.entries()) {
        selected = selections[index];
        const payload = await fileToUpload(file, { signal: task.signal });
        task.assertCurrent();
        uploadSelection.sending(selected);
        const url = requireUploadedUrl(
          await utils.client.admin.uploadPhoto.mutate(payload, {
            signal: task.signal,
          }),
        );
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
  const toggleTag = (slug: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(slug)
        ? prev.tags.filter((t) => t !== slug)
        : [...prev.tags, slug],
    }));
  };
  // ── Post list item ──
  const renderPostItem = ({ item }: { item: AdminPost }) => (
    <div
      data-testid={`admin-post-${item.id}`}
      className={["ui-stack ", classes.postItem].filter(Boolean).join(" ")}
    >
      <div
        className={["ui-stack ", classes.postItemHeader]
          .filter(Boolean)
          .join(" ")}
      >
        {item.photos && (item.photos as string[]).length > 0 && (
          <Picture
            source={{ uri: (item.photos as string[])[0] }}
            contentFit="cover"
            className={classes.postThumb}
          />
        )}
        {!(item.photos && (item.photos as string[]).length > 0) &&
          Array.isArray(item.media) &&
          item.media.some((media) => media?.type === "video") && (
            <div
              className={["ui-stack ", classes.postThumbVideo]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons name="videocam" size={22} color={CREAM_BG} />
            </div>
          )}
        <div
          className={["ui-stack ", classes.postItemInfo]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography lines={2} className={classes.postItemText}>
            {item.text}
          </Typography>
          <div
            className={["ui-stack ", classes.postItemMeta]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.postItemDate}>
              {new Date(item.publishedAt || item.createdAt).toLocaleDateString(
                "ru-RU",
              )}
            </Typography>
            <div
              className={[
                ["ui-stack ", classes.statusDraft].filter(Boolean).join(" "),
                !item.published
                  ? classes.backgroundColorState
                  : classes.backgroundColorState2,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography
                className={[
                  classes.statusDraftText,
                  !item.published ? classes.colorState : classes.colorState2,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.status === "scheduled"
                  ? "Отложен"
                  : item.published
                    ? "Опубликован"
                    : "Черновик"}
              </Typography>
            </div>
            <Typography className={classes.postItemDate}>
              {item.target === "club"
                ? "Клуб"
                : item.target === "both"
                  ? "Лента и клуб"
                  : "Лента"}
            </Typography>
          </div>
          <div
            className={["ui-stack ", classes.postItemTags]
              .filter(Boolean)
              .join(" ")}
          >
            {(item.tags as string[]).slice(0, 3).map((tag) => (
              <div
                key={tag}
                className={["ui-stack ", classes.miniTag]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.miniTagText}>
                  {ALL_TAGS.find((t) => t.slug === tag)?.label || tag}
                </Typography>
              </div>
            ))}
            {(item.tags as string[]).length > 3 && (
              <Typography className={classes.moreTagsText}>
                +{(item.tags as string[]).length - 3}
              </Typography>
            )}
          </div>
        </div>
      </div>
      <div
        className={["ui-stack ", classes.postItemActions]
          .filter(Boolean)
          .join(" ")}
      >
        <Action
          aria-label="Редактировать пост"
          onClick={() => handleEdit(item)}
          className={({ pressed }) =>
            [
              classes.action,
              pressed ? classes.opacityState : classes.opacityState2,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="edit" size={18} color={GREEN_ACCENT} />
        </Action>
        <Action
          aria-label="Удалить пост"
          onClick={() => handleDelete(item.id)}
          className={({ pressed }) =>
            [
              classes.action,
              pressed ? classes.opacityState3 : classes.opacityState4,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="delete-outline" size={18} color="#A85C5C" />
        </Action>
      </div>
    </div>
  );
  const closeForm = () => {
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
    resetForm();
  };
  // ── Form Modal ──
  const renderForm = () => {
    if (!showForm) return null;
    return (
      <Dialog
        label="Редактор публикации"
        open
        motion="slide"
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
              disabled={operation.busy}
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
                {form.photos.length > 0 && (
                  <div
                    className={["ui-stack ", classes.previewPhotos]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {form.photos.length === 1 ? (
                      <Picture
                        source={{ uri: form.photos[0] }}
                        contentFit="contain"
                        className={classes.previewSinglePhoto}
                      />
                    ) : (
                      <ScrollArea horizontal paging hideScrollbar>
                        {form.photos.map((uri, i) => (
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
            inert={operation.busy || showPreview}
            key="editor"
            contentClassName={classes.formContent}
            className={[
              classes.formScroll,
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
                key={editingId ?? `draft-${draftKey}`}
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
                disabled={operation.busy}
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
                photos={form.photos}
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
                disabled={operation.busy}
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
                      <Action
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
              disabled={operation.busy}
              onPick={attachments.pick}
              onRemove={attachments.remove}
            />

            {/* Tags */}
            <div
              className={["ui-stack ", classes.formGroup]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.formLabel}>Метки</Typography>
              <div
                className={["ui-stack ", classes.tagsGrid]
                  .filter(Boolean)
                  .join(" ")}
              >
                {ALL_TAGS.map((tag) => {
                  const isSelected = form.tags.includes(tag.slug);
                  return (
                    <Action
                      key={tag.slug}
                      onClick={() => toggleTag(tag.slug)}
                      className={[
                        classes.tagChipRubricSelected,
                        tag.rubric && isSelected
                          ? classes.appearanceState
                          : isSelected
                            ? classes.appearanceState2
                            : tag.rubric
                              ? classes.appearanceState3
                              : classes.appearanceState4,
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
                            ? classes.appearanceState5
                            : classes.appearanceState6,
                          isSelected
                            ? classes.colorState7
                            : classes.colorState8,
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
                Чем меньше число, тем выше пост в ленте
              </Typography>
            </div>
          </ScrollArea>
        </div>
      </Dialog>
    );
  };
  if (sessionError) return <SessionStatus />;
  if (authLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <div
          className={["ui-stack ", classes.loadingContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <Spinner size="large" color={GREEN_ACCENT} />
          <Typography className={classes.loadingText}>Загрузка...</Typography>
        </div>
      </ScreenContainer>
    );
  }
  if (!isAuthenticated || !isOwner) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <div
          className={["ui-stack ", classes.loadingContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="lock-outline" size={40} color={BROWN_LIGHT} />
          <Typography className={classes.loadingText}>
            Админка доступна только Дарье
          </Typography>
          <Action
            onClick={() => router.push("/login?next=/admin")}
            className={classes.newPostBtn}
          >
            <Typography className={classes.submitBtnText}>Войти</Typography>
          </Action>
        </div>
      </ScreenContainer>
    );
  }
  if (isLoading && viewTab === "posts") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <div
          className={["ui-stack ", classes.loadingContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <Spinner size="large" color={GREEN_ACCENT} />
          <Typography className={classes.loadingText}>
            Загрузка постов...
          </Typography>
        </div>
      </ScreenContainer>
    );
  }
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <div className={["ui-stack ", classes.header].filter(Boolean).join(" ")}>
        <Action
          aria-label="Вернуться в профиль"
          title="Вернуться в профиль"
          onClick={() => router.replace("/profile")}
          className={({ pressed }) =>
            [
              classes.mediaRemoveBtn,
              pressed ? classes.opacityState14 : classes.opacityState15,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="arrow-back" size={22} color={BROWN_DARK} />
        </Action>
        <Typography className={classes.headerTitle}>Админка</Typography>
        {viewTab === "posts" || viewTab === "calendar" ? (
          <Action
            onClick={handleCreate}
            className={({ pressed }) =>
              [
                classes.newPostBtn,
                pressed ? classes.opacityState16 : classes.opacityState17,
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <MaterialIcons name="add" size={18} color={CREAM_BG} />
            <Typography className={classes.submitBtnText}>Новый</Typography>
          </Action>
        ) : (
          <div
            className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
          />
        )}
      </div>

      <div
        className={["ui-stack ", classes.statsRow].filter(Boolean).join(" ")}
      >
        <div
          className={["ui-stack ", classes.statItem].filter(Boolean).join(" ")}
        >
          <Typography className={classes.statNumber}>
            {posts?.length || 0}
          </Typography>
          <Typography className={classes.formHint}>Всего</Typography>
        </div>
        <div
          className={["ui-stack ", classes.statItem].filter(Boolean).join(" ")}
        >
          <Typography className={classes.statNumber}>
            {posts?.filter((p) => p.published).length || 0}
          </Typography>
          <Typography className={classes.formHint}>Опубликовано</Typography>
        </div>
        <div
          className={["ui-stack ", classes.statItem].filter(Boolean).join(" ")}
        >
          <Typography className={classes.statNumber}>
            {posts?.filter((p) => p.status === "scheduled").length || 0}
          </Typography>
          <Typography className={classes.formHint}>Отложено</Typography>
        </div>
        <div
          className={["ui-stack ", classes.statItem].filter(Boolean).join(" ")}
        >
          <Typography className={classes.statNumber}>
            {posts?.filter(
              (p) =>
                p.status === "draft" ||
                (!p.published && p.status !== "scheduled"),
            ).length || 0}
          </Typography>
          <Typography className={classes.formHint}>Черновики</Typography>
        </div>
      </div>

      {/* View tabs */}
      <div
        className={["ui-stack ", classes.viewTabs].filter(Boolean).join(" ")}
      >
        <Action
          onClick={() => setViewTab("posts")}
          className={[
            classes.viewTabActive,
            viewTab === "posts"
              ? classes.backgroundColorState9
              : classes.backgroundColorState10,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="list"
            size={16}
            color={viewTab === "posts" ? CREAM_BG : BROWN_LIGHT}
          />
          <Typography
            className={[
              classes.targetChipTextActive,
              viewTab === "posts" ? classes.colorState13 : classes.colorState14,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Посты
          </Typography>
        </Action>
        <Action
          onClick={() => setViewTab("articles")}
          className={[
            classes.viewTabActive,
            viewTab === "articles"
              ? classes.backgroundColorState11
              : classes.backgroundColorState12,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="menu-book"
            size={16}
            color={viewTab === "articles" ? CREAM_BG : BROWN_LIGHT}
          />
          <Typography
            className={[
              classes.targetChipTextActive,
              viewTab === "articles"
                ? classes.colorState15
                : classes.colorState16,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Статьи
          </Typography>
        </Action>
        <Action
          onClick={() => setViewTab("calendar")}
          className={[
            classes.viewTabActive,
            viewTab === "calendar"
              ? classes.backgroundColorState13
              : classes.backgroundColorState14,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="calendar-month"
            size={16}
            color={viewTab === "calendar" ? CREAM_BG : BROWN_LIGHT}
          />
          <Typography
            className={[
              classes.targetChipTextActive,
              viewTab === "calendar"
                ? classes.colorState17
                : classes.colorState18,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Календарь
          </Typography>
        </Action>
        <Action
          onClick={() => setViewTab("stats")}
          className={[
            classes.viewTabActive,
            viewTab === "stats"
              ? classes.backgroundColorState15
              : classes.backgroundColorState16,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="bar-chart"
            size={16}
            color={viewTab === "stats" ? CREAM_BG : BROWN_LIGHT}
          />
          <Typography
            className={[
              classes.targetChipTextActive,
              viewTab === "stats" ? classes.colorState19 : classes.colorState20,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Статистика
          </Typography>
        </Action>
        <Action
          onClick={() => setViewTab("members")}
          className={[
            classes.viewTabActive,
            viewTab === "members"
              ? classes.backgroundColorState17
              : classes.backgroundColorState18,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="groups"
            size={16}
            color={viewTab === "members" ? CREAM_BG : BROWN_LIGHT}
          />
          <Typography
            className={[
              classes.targetChipTextActive,
              viewTab === "members"
                ? classes.colorState21
                : classes.colorState22,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Участницы
          </Typography>
        </Action>
        <Action
          onClick={() => setViewTab("payments")}
          className={[
            classes.viewTabActive,
            viewTab === "payments"
              ? classes.backgroundColorState19
              : classes.backgroundColorState20,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="payments"
            size={16}
            color={viewTab === "payments" ? CREAM_BG : BROWN_LIGHT}
          />
          <Typography
            className={[
              classes.targetChipTextActive,
              viewTab === "payments"
                ? classes.colorState23
                : classes.colorState24,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Оплаты
          </Typography>
        </Action>
        <Action
          onClick={() => setViewTab("reports")}
          className={[
            classes.viewTabActive,
            viewTab === "reports"
              ? classes.backgroundColorState21
              : classes.backgroundColorState22,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="flag"
            size={16}
            color={viewTab === "reports" ? CREAM_BG : BROWN_LIGHT}
          />
          <Typography
            className={[
              classes.targetChipTextActive,
              viewTab === "reports"
                ? classes.colorState25
                : classes.colorState26,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Жалобы
          </Typography>
        </Action>
      </div>

      {selectedListQuery?.isError ? (
        <QueryRetryState
          isLoading={false}
          isError
          onRetry={() => void selectedListQuery.refetch()}
          message="Не удалось загрузить список"
        />
      ) : viewTab === "articles" ? (
        <ArticlesAdmin />
      ) : viewTab === "calendar" ? (
        <ScrollArea
          className={classes.formScroll}
          contentClassName={classes.scrollAreacontent}
        >
          <CalendarTracker
            onPostPress={(post) => {
              handleEdit(post);
            }}
            onDayPress={(date) => {
              operation.cancel();
              saveCoordinator.current = new PostSaveCoordinator();
              attachments.reset();
              setEditingId(null);
              setForm({
                ...EMPTY_FORM,
                status: "scheduled",
                published: false,
                scheduledAt: date,
                target: "club",
              });
              setShowForm(true);
            }}
          />
        </ScrollArea>
      ) : viewTab === "stats" ? (
        <StatsDashboard />
      ) : viewTab === "members" ? (
        <Collection
          data={membersQuery.data || []}
          keyExtractor={(item) => String(item.id)}
          empty={
            <div
              className={["ui-stack ", classes.emptyContainer]
                .filter(Boolean)
                .join(" ")}
            >
              {membersQuery.isLoading ? (
                <Spinner color={GREEN_ACCENT} />
              ) : (
                <>
                  <MaterialIcons name="groups" size={48} color={BROWN_LIGHT} />
                  <Typography className={classes.emptyText}>
                    Пока нет участниц
                  </Typography>
                </>
              )}
            </div>
          }
          renderItem={({ item }) => (
            <div
              className={["ui-stack ", classes.postItem]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.postItemText}>
                {item.name || "Без имени"}
              </Typography>
              <Typography className={classes.postItemDate}>
                {item.email || "нет email"}
              </Typography>
              <div
                className={["ui-stack ", classes.postItemMeta]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={[
                    ["ui-stack ", classes.statusDraft]
                      .filter(Boolean)
                      .join(" "),
                    !item.clubExpiresAt
                      ? classes.backgroundColorState23
                      : classes.backgroundColorState24,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography
                    className={[
                      classes.statusDraftText,
                      !item.clubExpiresAt
                        ? classes.colorState27
                        : classes.colorState28,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {item.role === "admin"
                      ? "Админ"
                      : item.clubExpiresAt
                        ? `Клуб до ${formatAdminDate(item.clubExpiresAt)}`
                        : "Без клуба"}
                  </Typography>
                </div>
                {item.blockedAt ? (
                  <div
                    className={["ui-stack ", classes.statusBlocked]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.statusBlockedText}>
                      Заблокирована
                    </Typography>
                  </div>
                ) : null}
              </div>
              {item.blockedReason ? (
                <Typography className={classes.postItemDate}>
                  Причина: {item.blockedReason}
                </Typography>
              ) : null}
              <div
                className={["ui-stack ", classes.postItemActions]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Action
                  onClick={() =>
                    handleGrantClub(
                      item.id,
                      item.email || item.name || String(item.id),
                    )
                  }
                  disabled={grantClub.isPending}
                  className={classes.action}
                >
                  <Typography className={classes.grantBtnText}>
                    {item.clubExpiresAt ? "Продлить клуб" : "Выдать клуб"}
                  </Typography>
                </Action>
                {item.blockedAt ? (
                  <Action
                    onClick={() => unblockUser.mutate({ userId: item.id })}
                    disabled={unblockUser.isPending}
                    className={classes.action}
                  >
                    <Typography className={classes.grantBtnText}>
                      Разблокировать
                    </Typography>
                  </Action>
                ) : item.role !== "admin" ? (
                  <Action
                    onClick={() => {
                      const reason =
                        window.prompt(
                          "Причина блокировки",
                          "Нарушение правил клуба",
                        ) || "";
                      if (reason.trim().length >= 3) {
                        blockUser.mutate({
                          userId: item.id,
                          reason: reason.trim(),
                        });
                      }
                    }}
                    disabled={blockUser.isPending}
                    className={classes.action}
                  >
                    <Typography className={classes.typography}>
                      Заблокировать
                    </Typography>
                  </Action>
                ) : null}
              </div>
            </div>
          )}
          className={classes.formScroll}
          contentClassName={classes.listContent}
        />
      ) : viewTab === "reports" ? (
        <Collection
          data={reportsQuery.data || []}
          keyExtractor={(item) => String(item.id)}
          empty={
            <div
              className={["ui-stack ", classes.emptyContainer]
                .filter(Boolean)
                .join(" ")}
            >
              {reportsQuery.isLoading ? (
                <Spinner color={GREEN_ACCENT} />
              ) : (
                <>
                  <MaterialIcons name="flag" size={48} color={BROWN_LIGHT} />
                  <Typography className={classes.emptyText}>
                    Жалоб пока нет
                  </Typography>
                </>
              )}
            </div>
          }
          renderItem={({ item }) => (
            <div
              className={["ui-stack ", classes.postItem]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.postItemText}>
                Жалоба #{item.id}
              </Typography>
              <Typography className={classes.postItemDate}>
                {new Date(item.createdAt).toLocaleString("ru-RU")} · пост #
                {item.postId}
              </Typography>
              <Typography className={classes.postItemText}>
                {item.commentText}
              </Typography>
              <Typography className={classes.postItemDate}>
                Автор: {item.authorName || `#${item.authorUserId}`} · Жалоба от:{" "}
                {item.reporterName || `#${item.reporterUserId}`}
              </Typography>
              <Typography className={classes.postItemDate}>
                Причина: {item.reason}
              </Typography>
              <div
                className={["ui-stack ", classes.postItemActions]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Action
                  onClick={() => dismissReport.mutate({ reportId: item.id })}
                  disabled={dismissReport.isPending}
                  className={classes.action}
                >
                  <Typography className={classes.grantBtnText}>
                    Закрыть
                  </Typography>
                </Action>
                <Action
                  onClick={() => {
                    const ok = window.confirm("Удалить комментарий?");
                    if (!ok) return;
                    deleteReportedComment.mutate({
                      commentId: item.commentId,
                      reportId: item.id,
                    });
                  }}
                  disabled={deleteReportedComment.isPending}
                  className={classes.action}
                >
                  <Typography className={classes.typography}>
                    Удалить комментарий
                  </Typography>
                </Action>
                {item.authorUserId ? (
                  <Action
                    onClick={() => {
                      const reason =
                        window.prompt("Причина блокировки", item.reason) || "";
                      if (reason.trim().length >= 3) {
                        blockUser.mutate({
                          userId: item.authorUserId,
                          reason: reason.trim(),
                        });
                      }
                    }}
                    disabled={blockUser.isPending}
                    className={classes.action}
                  >
                    <Typography className={classes.typography}>
                      Заблокировать автора
                    </Typography>
                  </Action>
                ) : null}
              </div>
            </div>
          )}
          className={classes.formScroll}
          contentClassName={classes.listContent}
        />
      ) : viewTab === "payments" ? (
        <Collection
          data={paymentsQuery.data || []}
          keyExtractor={(item) => String(item.id)}
          empty={
            <div
              className={["ui-stack ", classes.emptyContainer]
                .filter(Boolean)
                .join(" ")}
            >
              {paymentsQuery.isLoading ? (
                <Spinner color={GREEN_ACCENT} />
              ) : (
                <>
                  <MaterialIcons
                    name="payments"
                    size={48}
                    color={BROWN_LIGHT}
                  />
                  <Typography className={classes.emptyText}>
                    Оплат пока нет
                  </Typography>
                </>
              )}
            </div>
          }
          renderItem={({ item }) => (
            <div
              className={["ui-stack ", classes.postItem]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.postItemText}>
                {item.email || item.orderId}
              </Typography>
              <Typography className={classes.postItemDate}>
                {item.status === "paid" ? "Оплачено" : item.status} ·{" "}
                {item.sum ? `${item.sum} ₽` : "—"} ·{" "}
                {formatAdminDate(item.paidAt || item.createdAt)}
              </Typography>
              <Typography className={classes.postItemDate}>
                Доступ до {formatAdminDate(item.expiresAt)} · заказ{" "}
                {item.orderId}
              </Typography>
            </div>
          )}
          className={classes.formScroll}
          contentClassName={classes.listContent}
        />
      ) : (
        <Collection
          data={posts || []}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id.toString()}
          hideScrollbar
          empty={
            <div
              className={["ui-stack ", classes.emptyContainer]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons name="post-add" size={48} color={BROWN_LIGHT} />
              <Typography className={classes.emptyText}>
                Пока нет постов
              </Typography>
              <Typography className={classes.emptySubtext}>
                Создайте первый пост для ленты
              </Typography>
            </div>
          }
          className={classes.formScroll}
          contentClassName={classes.listContent}
        />
      )}

      {renderForm()}
    </ScreenContainer>
  );
}
