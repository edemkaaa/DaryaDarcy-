"use client";
import classes from "./club-comments.module.scss";
import {
  Typography,
  Dialog,
  Action,
  Field,
  Spinner,
} from "@/shared/ui/elements";
import { safeExternalUrl } from "@/shared/navigation/external-url";
import { useMemo, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { useAuth } from "@/domain/session/session-context";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { trpc } from "@/shared/api/trpc";
import {
  areCommentsOpen,
  commentsCloseAt,
  isCommunityPost,
} from "@/domain/post/club-tags";
import { normalizeLinkUrl } from "@/shared/media/photo-aspect-ratios";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { getHttpStatus } from "@/shared/api/errors";
import { requireUploadedUrl } from "@/shared/media/upload-result";
import { fileToUpload, pickWebFiles } from "@/shared/media/image-upload";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import {
  COMMENT_CHAR_LIMIT,
  commentCountLabel,
} from "@/domain/post/comment-count-label";
import {
  useCollectionItemRetention,
  useCollectionItemPlaceholder,
} from "@/shared/ui/collection-item-window";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { BROWN_MUTED, OLIVE } from "./club-comments.content";
interface ClubCommentsProps {
  postId: number;
  tags: string[];
  createdAt: string | Date | null;
  commentCount?: number;
}
type MenuAction = "edit" | "delete" | "report";
function authorInitial(name: string | null | undefined): string {
  const trimmed = (name || "У").trim();
  return trimmed.slice(0, 1).toUpperCase();
}
function CommentAvatar({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <Picture
        source={{ uri: avatarUrl }}
        contentFit="cover"
        className={classes.avatar}
      />
    );
  }
  return (
    <div
      className={["ui-stack ", classes.avatarFallback]
        .filter(Boolean)
        .join(" ")}
    >
      <Typography className={classes.avatarInitial}>
        {authorInitial(name)}
      </Typography>
    </div>
  );
}
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
  return parts.map((part, index) => {
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const url = safeExternalUrl(normalizeLinkUrl(part));
      if (!url) return <Typography key={`${index}-t`}>{part}</Typography>;
      return (
        <a
          key={`${index}-${part}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className={`ui-inline-link ${classes.link}`}
        >
          {part}
        </a>
      );
    }
    return <Typography key={`${index}-t`}>{part}</Typography>;
  });
}
function confirmDelete(onConfirm: () => void) {
  {
    if (typeof window !== "undefined" && window.confirm("Удалить комментарий?"))
      onConfirm();
    return;
  }
}
function CommentMenu({
  visible,
  showEdit,
  showDelete,
  showReport,
  onClose,
  onSelect,
}: {
  visible: boolean;
  showEdit: boolean;
  showDelete: boolean;
  showReport: boolean;
  onClose: () => void;
  onSelect: (action: MenuAction) => void;
}) {
  if (!visible) return null;
  return (
    <Dialog
      label="Действия с комментарием"
      open={visible}
      motion="fade"
      onClose={onClose}
    >
      <div
        onClick={onClose}
        className={["ui-stack ", classes.menuOverlay].filter(Boolean).join(" ")}
      >
        <div
          className={["ui-stack ", classes.menuSheet].filter(Boolean).join(" ")}
        >
          {showEdit ? (
            <Action
              onClick={() => onSelect("edit")}
              className={classes.menuItem}
            >
              <MaterialIcons name="edit" size={20} color={OLIVE} />
              <Typography className={classes.menuItemText}>
                Редактировать
              </Typography>
            </Action>
          ) : null}
          {showEdit && showDelete ? (
            <div
              className={["ui-stack ", classes.menuDivider]
                .filter(Boolean)
                .join(" ")}
            />
          ) : null}
          {showDelete ? (
            <Action
              onClick={() => onSelect("delete")}
              className={classes.menuItem}
            >
              <MaterialIcons name="delete-outline" size={20} color="#A85C5C" />
              <Typography className={classes.menuItemDanger}>
                Удалить
              </Typography>
            </Action>
          ) : null}
          {showReport ? (
            <Action
              onClick={() => onSelect("report")}
              className={classes.menuItem}
            >
              <MaterialIcons name="flag" size={20} color={BROWN_MUTED} />
              <Typography className={classes.menuItemText}>
                Пожаловаться
              </Typography>
            </Action>
          ) : null}
          <Action onClick={onClose} className={classes.menuCancel}>
            <Typography className={classes.menuCancelText}>Отмена</Typography>
          </Action>
        </div>
      </div>
    </Dialog>
  );
}
export function ClubComments({
  postId,
  tags,
  createdAt,
  commentCount: commentCountProp,
}: ClubCommentsProps) {
  const { isAuthenticated, user } = useAuth();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const operation = useSessionOperation(true, postId);
  const uploading = operation.kind === "photos";
  const [actionError, setActionError] = useState<string | null>(null);
  const uncertainSend = useRef(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [menuCommentId, setMenuCommentId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const nearby = useCollectionItemRetention(
    Boolean(
      text ||
      photos.length ||
      replyTo ||
      editingId ||
      editText ||
      menuCommentId ||
      viewerVisible ||
      operation.busy ||
      actionError,
    ),
  );
  const active = useScreenActive();
  const utils = trpc.useUtils();
  const community = isCommunityPost(tags);
  const open = areCommentsOpen(tags, createdAt);
  const until = commentsCloseAt(createdAt);
  const comments = trpc.club.comments.useQuery(
    { postId },
    {
      enabled: community && active && nearby,
      staleTime: 60_000,
      gcTime: 60_000,
    },
  );
  const commentPlaceholder = useCollectionItemPlaceholder(
    "comments",
    !comments.data,
  );
  const runAction = async (
    kind: string,
    perform: (signal: AbortSignal) => Promise<unknown>,
    commit: () => void,
  ) => {
    const task = operation.begin(kind);
    if (!task) return;
    setActionError(null);
    try {
      const result = await perform(task.signal);
      if (
        ["edit", "delete", "report"].includes(kind) &&
        (!result ||
          typeof result !== "object" ||
          (result as { ok?: unknown }).ok !== true)
      )
        throw new Error("Сервер не подтвердил действие");
      if (
        kind === "like" &&
        (!result ||
          typeof result !== "object" ||
          typeof (result as { liked?: unknown }).liked !== "boolean")
      )
        throw new Error("Сервер не подтвердил отметку");
      task.assertCurrent();
      commit();
      void utils.club.comments.invalidate({ postId });
    } catch (error) {
      checkOperationAccessError(error);
      const status = getHttpStatus(error);
      if (task.isCurrent() && kind === "send" && (!status || status >= 500))
        uncertainSend.current = true;
      if (task.isCurrent())
        setActionError(
          uncertainSend.current && kind === "send"
            ? "Отправка не подтверждена. Проверьте список комментариев перед новой попыткой."
            : error instanceof Error
              ? error.message
              : "Не удалось выполнить действие",
        );
    } finally {
      task.finish();
    }
  };
  const add = {
    isPending: operation.kind === "send",
    error: actionError ? { message: actionError } : null,
    mutate: (
      input: Parameters<typeof utils.client.club.addComment.mutate>[0],
    ) => {
      if (uncertainSend.current) {
        setActionError(
          "Отправка не подтверждена. Проверьте список комментариев перед новой попыткой.",
        );
        void comments.refetch();
        return;
      }
      void runAction(
        "send",
        async (signal) => {
          const result = await utils.client.club.addComment.mutate(input, {
            signal,
          });
          if (!result || !Number.isSafeInteger(result.id) || result.id <= 0)
            throw new Error("Сервер не подтвердил отправку комментария");
        },
        () => {
          setText("");
          setPhotos([]);
          setReplyTo(null);
        },
      );
    },
  };
  const update = {
    isPending: operation.kind === "edit",
    mutate: (
      input: Parameters<typeof utils.client.club.updateComment.mutate>[0],
    ) =>
      void runAction(
        "edit",
        (signal) => utils.client.club.updateComment.mutate(input, { signal }),
        () => {
          setEditingId(null);
          setEditText("");
        },
      ),
  };
  const remove = {
    mutate: (input: { id: number }) =>
      void runAction(
        "delete",
        (signal) => utils.client.club.deleteComment.mutate(input, { signal }),
        () => {},
      ),
  };
  const report = {
    mutate: (input: { id: number; reason: string }) =>
      void runAction(
        "report",
        (signal) => utils.client.club.reportComment.mutate(input, { signal }),
        () => window.alert("Жалоба отправлена. Спасибо!"),
      ),
  };
  const toggleLike = {
    isPending: operation.kind === "like",
    mutate: (input: { commentId: number }) =>
      void runAction(
        "like",
        (signal) =>
          utils.client.club.toggleCommentLike.mutate(input, { signal }),
        () => {},
      ),
  };
  const tree = useMemo(() => {
    const rows = comments.data || [];
    const roots = rows.filter((c) => !c.parentId);
    const byParent = new Map<number, typeof rows>();
    for (const row of rows) {
      if (!row.parentId) continue;
      const list = byParent.get(row.parentId) || [];
      list.push(row);
      byParent.set(row.parentId, list);
    }
    return { roots, byParent };
  }, [comments.data]);
  if (!community) return null;
  const loadedCount = comments.data?.length ?? 0;
  const commentCount = commentCountProp ?? loadedCount;
  const untilLabel = until
    ? until.toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const staff = user?.role === "admin" || user?.role === "moderator";
  const menuComment =
    comments.data?.find((row) => row.id === menuCommentId) ?? null;
  const menuIsOwner = !!menuComment && user?.id === menuComment.userId;
  const menuIsStaffOther =
    !!menuComment && staff && user?.id !== menuComment.userId;
  const openPhotoViewer = (photoList: string[], index: number) => {
    setViewerPhotos(photoList);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };
  const handleMenuSelect = (action: MenuAction) => {
    const id = menuCommentId;
    setMenuCommentId(null);
    if (!id) return;
    if (action === "edit") {
      const row = comments.data?.find((c) => c.id === id);
      if (row) {
        setEditingId(id);
        setEditText(row.text);
      }
      return;
    }
    if (action === "delete") {
      confirmDelete(() => remove.mutate({ id }));
      return;
    }
    if (action === "report") {
      report.mutate({ id, reason: "Нарушение правил клуба" });
    }
  };
  const pickPhotos = async () => {
    if (photos.length >= 2) return;
    const task = operation.begin("photos");
    if (!task) return;
    setActionError(null);
    try {
      const slots = 2 - photos.length;
      const files = await pickWebFiles("image/*", slots > 1, {
        signal: task.signal,
        maxFiles: slots,
      });
      for (const file of files) {
        const payload = await fileToUpload(file, { signal: task.signal });
        task.assertCurrent();
        const url = requireUploadedUrl(
          await utils.client.club.uploadCommentPhoto.mutate(payload, {
            signal: task.signal,
          }),
        );
        task.assertCurrent();
        setPhotos((prev) => [...prev, url].slice(0, 2));
      }
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        setActionError(
          error instanceof Error ? error.message : "Не удалось загрузить фото",
        );
    } finally {
      task.finish();
    }
  };
  const renderComment = (item: (typeof tree.roots)[number], depth = 0) => {
    const isEditing = editingId === item.id;
    const canOpenMenu =
      isAuthenticated &&
      (user?.id === item.userId || staff || user?.id !== item.userId);
    return (
      <div
        key={item.id}
        style={{
          ...((depth > 0 ? true : false)
            ? { marginLeft: depth > 0 ? 14 : undefined }
            : {}),
          ...((depth > 0 ? true : false)
            ? { marginTop: depth > 0 ? 8 : undefined }
            : {}),
          ...((depth > 0 ? true : false)
            ? { gap: depth > 0 ? 8 : undefined }
            : {}),
        }}
        className="ui-stack "
      >
        <div
          className={["ui-stack ", classes.commentBlock]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.commentHeader]
              .filter(Boolean)
              .join(" ")}
          >
            <CommentAvatar
              name={item.authorName}
              avatarUrl={item.authorAvatarUrl ?? null}
            />
            <Typography className={classes.author}>
              {item.authorName || "Участница"}
            </Typography>
            {canOpenMenu ? (
              <Action
                aria-label="Действия с комментарием"
                onClick={() => setMenuCommentId(item.id)}
                hitArea={8}
                className={classes.menuBtn}
              >
                <MaterialIcons name="more-vert" size={20} color={BROWN_MUTED} />
              </Action>
            ) : (
              <div
                className={["ui-stack ", classes.menuBtnPlaceholder]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
          </div>

          {isEditing ? (
            <div
              className={["ui-stack ", classes.editBlock]
                .filter(Boolean)
                .join(" ")}
            >
              <Field
                disabled={operation.busy}
                value={editText}
                onValueChange={setEditText}
                multiline
                maxLength={COMMENT_CHAR_LIMIT}
                className={classes.editInput}
              />
              <Typography
                className={[
                  classes.charCountWarn,
                  editText.length > COMMENT_CHAR_LIMIT * 0.9
                    ? classes.colorState
                    : classes.colorState2,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {editText.length}/{COMMENT_CHAR_LIMIT}
              </Typography>
              <div
                className={["ui-stack ", classes.editActions]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Action
                  onClick={() => {
                    setEditingId(null);
                    setEditText("");
                  }}
                >
                  <Typography className={classes.editCancel}>Отмена</Typography>
                </Action>
                <Action
                  onClick={() => {
                    const value = editText.trim();
                    if (!value || update.isPending) return;
                    update.mutate({ id: item.id, text: value });
                  }}
                  disabled={operation.busy || !editText.trim()}
                  aria-label="Сохранить"
                  aria-busy={update.isPending}
                  className={classes.editSave}
                >
                  {update.isPending ? (
                    <Spinner size="small" color="#fff" />
                  ) : (
                    <Typography className={classes.editSaveText}>
                      Сохранить
                    </Typography>
                  )}
                </Action>
              </div>
            </div>
          ) : (
            <Typography selectable={false} className={classes.body}>
              {linkify(item.text)}
            </Typography>
          )}

          {Array.isArray(item.photos) && item.photos.length > 0 ? (
            <div
              className={["ui-stack ", classes.photoRow]
                .filter(Boolean)
                .join(" ")}
            >
              {item.photos.slice(0, 2).map((uri, photoIndex, arr) => (
                <Action
                  key={uri}
                  onClick={() => openPhotoViewer(arr, photoIndex)}
                  role="button"
                  aria-label="Открыть фото"
                  className={classes.photoPressable}
                >
                  <Picture
                    source={{ uri }}
                    contentFit="cover"
                    className={classes.photo}
                  />
                </Action>
              ))}
            </div>
          ) : null}

          <div
            className={["ui-stack ", classes.footerRow]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              aria-label={
                item.likedByMe
                  ? "Убрать лайк комментария"
                  : "Поставить лайк комментарию"
              }
              aria-pressed={Boolean(item.likedByMe)}
              onClick={() => {
                if (!isAuthenticated) return;
                toggleLike.mutate({ commentId: item.id });
              }}
              disabled={!isAuthenticated || operation.busy}
              className={classes.likeBtn}
            >
              <MaterialIcons
                name={item.likedByMe ? "favorite" : "favorite-border"}
                size={18}
                color={item.likedByMe ? "#A85C5C" : BROWN_MUTED}
              />
              {item.likeCount > 0 ? (
                <Typography className={classes.likeCount}>
                  {item.likeCount}
                </Typography>
              ) : null}
            </Action>
            {open && isAuthenticated ? (
              <Action onClick={() => setReplyTo(item.id)}>
                <Typography className={classes.replyBtn}>Ответить</Typography>
              </Action>
            ) : null}
          </div>
        </div>
        {(tree.byParent.get(item.id) || []).map((child) =>
          renderComment(child, depth + 1),
        )}
      </div>
    );
  };
  return (
    <div className={["ui-stack ", classes.wrap].filter(Boolean).join(" ")}>
      {commentCount > 0 ? (
        <Typography className={classes.countHeading}>
          {commentCountLabel(commentCount)}
        </Typography>
      ) : null}
      {open ? (
        <Typography className={classes.meta}>
          Комментарии открыты до {untilLabel}
        </Typography>
      ) : null}
      <div
        className={["ui-stack ", classes.commentList].filter(Boolean).join(" ")}
        ref={commentPlaceholder.ref}
        style={commentPlaceholder.style}
      >
        <QueryRetryState
          isLoading={comments.isLoading}
          isError={comments.isError}
          onRetry={() => void comments.refetch()}
          message="Не удалось загрузить комментарии"
        />
        {tree.roots.map((item) => renderComment(item))}
      </div>
      {open && isAuthenticated ? (
        <div
          className={["ui-stack ", classes.commentBlock]
            .filter(Boolean)
            .join(" ")}
        >
          {replyTo ? (
            <Action onClick={() => setReplyTo(null)}>
              <Typography className={classes.cancelReply}>
                Отмена ответа
              </Typography>
            </Action>
          ) : null}
          <Field
            disabled={operation.busy}
            value={text}
            onValueChange={setText}
            placeholder={replyTo ? "Ваш ответ..." : "Написать комментарий..."}
            placeholderColor={BROWN_MUTED}
            maxLength={COMMENT_CHAR_LIMIT}
            multiline
            className={classes.input}
          />
          <Typography
            className={[
              classes.charCountWarn,
              text.length > COMMENT_CHAR_LIMIT * 0.9
                ? classes.colorState3
                : classes.colorState4,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {text.length}/{COMMENT_CHAR_LIMIT}
          </Typography>
          {photos.length > 0 ? (
            <div
              className={["ui-stack ", classes.photoRow]
                .filter(Boolean)
                .join(" ")}
            >
              {photos.map((uri) => (
                <div
                  key={uri}
                  className={["ui-stack ", classes.draftPhotoWrap]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Picture
                    source={{ uri }}
                    contentFit="cover"
                    className={classes.photo}
                  />
                  <Action
                    onClick={() =>
                      setPhotos((prev) => prev.filter((p) => p !== uri))
                    }
                    className={classes.removePhoto}
                  >
                    <Typography className={classes.removePhotoText}>
                      ×
                    </Typography>
                  </Action>
                </div>
              ))}
            </div>
          ) : null}
          <div
            className={["ui-stack ", classes.commentHeader]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={() => void pickPhotos()}
              aria-label={`Фото (${photos.length}/2)`}
              aria-busy={uploading}
              disabled={operation.busy || photos.length >= 2}
              className={classes.attachBtn}
            >
              {uploading ? (
                <Spinner size="small" color={OLIVE} />
              ) : (
                <Typography className={classes.replyBtn}>
                  Фото ({photos.length}/2)
                </Typography>
              )}
            </Action>
            <Action
              onClick={() => {
                const value = text.trim();
                if (!value || add.isPending) return;
                add.mutate({
                  postId,
                  text: value,
                  parentId: replyTo ?? undefined,
                  photos: photos.length ? photos : undefined,
                });
              }}
              disabled={operation.busy || !text.trim()}
              aria-label="Отправить"
              aria-busy={add.isPending}
              className={classes.send}
            >
              {add.isPending ? (
                <Spinner size="small" color="#fff" />
              ) : (
                <Typography className={classes.editSaveText}>
                  Отправить
                </Typography>
              )}
            </Action>
          </div>
        </div>
      ) : null}
      {open && !isAuthenticated ? (
        <Typography className={classes.meta}>
          Войдите, чтобы оставить комментарий
        </Typography>
      ) : null}
      {add.error ? (
        <Typography role="alert" className={classes.error}>
          {add.error.message}
        </Typography>
      ) : null}
      <CommentMenu
        visible={menuCommentId != null}
        showEdit={menuIsOwner}
        showDelete={menuIsOwner || menuIsStaffOther}
        showReport={!!menuComment && !menuIsOwner && !menuIsStaffOther}
        onClose={() => setMenuCommentId(null)}
        onSelect={handleMenuSelect}
      />
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
    </div>
  );
}
