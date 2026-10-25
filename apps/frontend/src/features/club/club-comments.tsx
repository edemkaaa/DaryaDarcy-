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
import { useEffect, useMemo, useState } from "react";
import { getQueryKey } from "@trpc/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/domain/subscription/subscription-context";
import { useCursorPages } from "@/shared/api/use-cursor-pages";
import type { CursorChain } from "@/shared/api/cursor-pages";
import type { ApiInputs, ApiOutputs } from "@/shared/api/types";
import { CommentReplies, type PagedComment } from "./comment-replies";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { useAuth } from "@/domain/session/session-context";
import { ContentRequestState } from "@/shared/ui/content-request-state";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { trpc } from "@/shared/api/trpc";
import {
  useCapabilities,
  getAppCapabilities,
  uploadUnavailableMessage,
} from "@/shared/api/capabilities";
import {
  areCommentsOpen,
  commentsCloseAt,
  isCommunityPost,
} from "@/domain/post/club-tags";
import { normalizeLinkUrl } from "@/shared/media/photo-aspect-ratios";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { requireOk, requireCommentLike } from "@/shared/api/action-result";
import { useConfirmedAction } from "@/domain/session/use-confirmed-action";
import { usePrivateCommentFiles } from "./use-private-comment-files";
import type { PrivateCommentRecord } from "@/domain/post/private-comment-save";
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
export function ClubComments(props: ClubCommentsProps) {
  const { user } = useAuth();
  return (
    <CommentThread key={`${user?.id ?? "guest"}:${props.postId}`} {...props} />
  );
}
function CommentThread({
  postId,
  tags,
  createdAt,
  commentCount: commentCountProp,
}: ClubCommentsProps) {
  const { isAuthenticated, user } = useAuth();
  const { hasClubAccess } = useClub();
  const cache = useQueryClient();
  const [branchError, setBranchError] = useState<unknown>(null);
  const capabilities = useCapabilities();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const active = useScreenActive();
  const action = useConfirmedAction(active, postId);
  const operation = action.operation;
  const uploading = operation.kind === "photos";
  const actionError = action.error;
  const setActionError = action.setError;
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
      actionError ||
      action.unknown,
    ),
  );
  const utils = trpc.useUtils();
  const community = isCommunityPost(tags);
  const privateFiles = usePrivateCommentFiles(
    active && nearby && community && isAuthenticated,
    postId,
    (task, parentId) => readComments(task.signal, parentId),
  );
  const pendingPrivate = privateFiles.record;
  const composeBlocked =
    action.blocked ||
    Boolean(pendingPrivate) ||
    privateFiles.loading ||
    Boolean(privateFiles.error);
  const open = areCommentsOpen(tags, createdAt);
  const until = commentsCloseAt(createdAt);
  const commentInput = { postId, limit: 20 };
  const commentScope = `${user?.id ?? "guest"}:${hasClubAccess}`;
  const commentsEnabled = isAuthenticated && community && active && nearby;
  const comments = useCursorPages({
    key: getQueryKey(trpc.club.commentsPage, commentInput, "query"),
    scope: commentScope,
    staleTime: 60_000,
    gcTime: 60_000,
    enabled: commentsEnabled,
    fetchPage: (cursor, signal) =>
      utils.client.club.commentsPage.query(
        { ...commentInput, cursor },
        { signal },
      ),
  });
  useEffect(() => {
    setBranchError(null);
  }, [comments.dataUpdatedAt]);
  const denied =
    comments.denied ||
    [401, 403, 404].includes(getHttpStatus(branchError) ?? 0);
  const cancelOperation = operation.cancel;
  const resetUploads = privateFiles.reset;
  useEffect(() => {
    if (!denied) return;
    cancelOperation();
    resetUploads();
    setText("");
    setPhotos([]);
    setReplyTo(null);
    setEditingId(null);
    setEditText("");
    setMenuCommentId(null);
    setViewerVisible(false);
    setViewerPhotos([]);
  }, [denied, cancelOperation, resetUploads]);
  const commentPlaceholder = useCollectionItemPlaceholder(
    "comments",
    !comments.data,
  );
  // Read the existing page containing a changed parent; head polling must not
  // leave replyCount stale on a retained second or later page.
  const refreshCommentRow = async (
    id: number,
    signal?: AbortSignal,
    refreshGroup = false,
  ) => {
    const queries = cache.getQueryCache().findAll({
      queryKey: getQueryKey(trpc.club.commentsPage, { postId }, "query"),
      predicate: (query) =>
        (query.queryKey[2] as { ownerScope?: string })?.ownerScope ===
        commentScope,
    });
    for (const query of queries) {
      const chain = query.state.data as
        | CursorChain<ApiOutputs["club"]["commentsPage"]>
        | undefined;
      const index =
        chain?.pages.findIndex((page) =>
          page.items.some((row) => row.id === id),
        ) ?? -1;
      if (!chain || index < 0) continue;
      const input = (
        query.queryKey[1] as {
          input: { postId: number; parentId?: number; limit: number };
        }
      ).input;
      const page = await utils.client.club.commentsPage.query(
        { ...input, cursor: chain.pageParams[index] },
        { signal },
      );
      signal?.throwIfAborted();
      const row = page.items.find((item) => item.id === id);
      if (!row && !refreshGroup) throw invalidResponse();
      cache.setQueryData<CursorChain<ApiOutputs["club"]["commentsPage"]>>(
        query.queryKey,
        (current) => {
          if (!current) return current;
          // A deletion can promote replies and change this page's boundary.
          // Keep only the prefix whose cursors still describe the server list.
          if (refreshGroup)
            return current.pageParams[index] === chain.pageParams[index]
              ? {
                  pages: [...current.pages.slice(0, index), page],
                  pageParams: current.pageParams.slice(0, index + 1),
                }
              : current;
          if (!row) return current;
          return {
            ...current,
            pages: current.pages.map((part) => ({
              ...part,
              items: part.items.map((item) => (item.id === id ? row : item)),
            })),
          };
        },
      );
    }
  };
  const readComments = async (signal?: AbortSignal, parentId?: number) => {
    signal?.throwIfAborted();
    if (parentId) await refreshCommentRow(parentId, signal);
    const result = await comments.refetch();
    signal?.throwIfAborted();
    if (!result.isSuccess || !Array.isArray(result.data?.pages))
      throw result.error ?? invalidResponse();
    await cache.refetchQueries(
      {
        queryKey: getQueryKey(trpc.club.commentsPage, { postId }, "query"),
        type: "active",
        predicate: (query) =>
          Boolean(
            (query.queryKey[1] as { input?: { parentId?: number } })?.input
              ?.parentId,
          ),
      },
      { throwOnError: true, cancelRefetch: false },
    );
    signal?.throwIfAborted();
  };
  const refreshCounts = () => {
    void utils.club.list.invalidate();
    void utils.feed.getById.invalidate({ id: postId });
  };
  const refreshMissingBranch = async (parentId: number) => {
    const task = operation.begin("refresh-comments");
    if (!task) return;
    setActionError(null);
    try {
      await refreshCommentRow(parentId, task.signal, true);
      const result = await comments.refetch();
      task.assertCurrent();
      if (!result.isSuccess) throw result.error ?? invalidResponse();
      // Keep the composed text/photos; only the vanished reply target is lost.
      if (replyTo === parentId) setReplyTo(null);
      if (editingId === parentId) setEditingId(null);
      refreshCounts();
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) setActionError(getRequestErrorMessage(cause));
    } finally {
      task.finish();
    }
  };
  const runAction = (
    kind: string,
    label: string,
    perform: (signal: AbortSignal) => Promise<unknown>,
    commit: (result: unknown) => void,
    validate = requireOk,
    keepBlocked = false,
    read: (signal: AbortSignal) => Promise<void> = readComments,
  ) =>
    void action.run({
      kind,
      label,
      perform,
      validate,
      commit: (result) => {
        commit(result);
        void utils.club.commentsPage.invalidate({ postId });
      },
      read,
      keepBlocked,
    });
  const sendLegacy = (input: ApiInputs["club"]["addComment"]) => {
    runAction(
      "send",
      "Отправить комментарий",
      (signal) => utils.client.club.addComment.mutate(input, { signal }),
      () => {
        if (input.parentId) {
          // The write is already confirmed. A failed follow-up read must
          // neither hide the reply button nor turn it into an unknown write.
          cache.setQueriesData<CursorChain<ApiOutputs["club"]["commentsPage"]>>(
            {
              queryKey: getQueryKey(
                trpc.club.commentsPage,
                { postId },
                "query",
              ),
            },
            (chain) =>
              chain && {
                ...chain,
                pages: chain.pages.map((page) => ({
                  ...page,
                  items: page.items.map((row) =>
                    row.id === input.parentId
                      ? { ...row, replyCount: row.replyCount + 1 }
                      : row,
                  ),
                })),
              },
          );
          void refreshCommentRow(input.parentId).catch((cause) => {
            checkOperationAccessError(cause);
            setActionError(
              "Комментарий сохранён, но обновить обсуждение не удалось. Откройте ответы повторно.",
            );
          });
        }
        setText("");
        setPhotos([]);
        setReplyTo(null);
        refreshCounts();
      },
      (result) => {
        const id = (result as { id?: unknown } | null)?.id;
        if (!Number.isSafeInteger(id) || (id as number) <= 0)
          throw invalidResponse();
      },
      true,
    );
  };
  const clearComposer = () => {
    setText("");
    setPhotos([]);
    setReplyTo(null);
    refreshCounts();
  };
  const sendPrivate = async (
    record?: PrivateCommentRecord,
    input: ApiInputs["club"]["addComment"] = {
      postId,
      text: text.trim(),
      parentId: replyTo ?? undefined,
    },
  ) => {
    const task = operation.begin("send");
    if (!task) return;
    setActionError(null);
    let legacy = false;
    try {
      let current = record;
      if (!current) {
        if (!photos.length) {
          // Resolve the actual server gate before choosing a wire contract.
          // A pending/stale capability query cannot cause an unkeyed write.
          const currentCapabilities = await getAppCapabilities(task.signal);
          task.assertCurrent();
          if (!currentCapabilities.privateContentUploads) {
            legacy = true;
            return;
          }
        }
        const prepared = await privateFiles.prepare(input, photos, task);
        if (prepared.restored) {
          setActionError(
            "На этом устройстве уже есть отправка. Восстановите её перед повтором.",
          );
          return;
        }
        current = prepared.record;
      }
      await privateFiles.save(current, task);
      task.assertCurrent();
      clearComposer();
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) setActionError(getRequestErrorMessage(error));
    } finally {
      const handoff = legacy && task.isCurrent();
      task.finish();
      if (handoff) sendLegacy(input);
    }
  };
  const add = {
    isPending: operation.kind === "send",
    error: actionError ? { message: actionError } : null,
    mutate: (input: ApiInputs["club"]["addComment"]) =>
      void sendPrivate(undefined, input),
  };
  const readOrDiscardPrivate = async (discard: boolean) => {
    if (!pendingPrivate) return;
    const task = operation.begin("check-private-comment");
    if (!task) return;
    try {
      if (discard) {
        await privateFiles.discard(pendingPrivate, task);
        task.assertCurrent();
        clearComposer();
      } else {
        await privateFiles.read(task);
        setActionError(
          "Комментарии обновлены. Повтор отправки использует прежние данные и ключ.",
        );
      }
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) setActionError(getRequestErrorMessage(error));
    } finally {
      task.finish();
    }
  };
  const update = {
    isPending: operation.kind === "edit",
    mutate: (
      input: Parameters<typeof utils.client.club.updateComment.mutate>[0],
    ) =>
      runAction(
        "edit",
        "Сохранить комментарий",
        (signal) => utils.client.club.updateComment.mutate(input, { signal }),
        () => {
          cache.setQueriesData<CursorChain<ApiOutputs["club"]["commentsPage"]>>(
            {
              queryKey: getQueryKey(
                trpc.club.commentsPage,
                { postId },
                "query",
              ),
            },
            (chain) =>
              chain && {
                ...chain,
                pages: chain.pages.map((page) => ({
                  ...page,
                  items: page.items.map((row) =>
                    row.id === input.id ? { ...row, text: input.text } : row,
                  ),
                })),
              },
          );
          setEditingId(null);
          setEditText("");
        },
        requireOk,
        false,
        async (signal) => {
          await refreshCommentRow(input.id, signal);
          await readComments(signal);
        },
      ),
  };
  const remove = {
    mutate: (input: { id: number }) =>
      runAction(
        "delete",
        "Удалить комментарий",
        (signal) => utils.client.club.deleteComment.mutate(input, { signal }),
        () => {
          if (replyTo === input.id) setReplyTo(null);
          cache.setQueriesData<CursorChain<ApiOutputs["club"]["commentsPage"]>>(
            {
              queryKey: getQueryKey(
                trpc.club.commentsPage,
                { postId },
                "query",
              ),
            },
            (chain) =>
              chain && {
                pages: chain.pages.slice(0, 1).map((page) => ({
                  ...page,
                  items: page.items.filter((row) => row.id !== input.id),
                })),
                pageParams: [null],
              },
          );
          refreshCounts();
        },
        requireOk,
        false,
        async (signal) => {
          await refreshCommentRow(input.id, signal, true);
          await readComments(signal);
        },
      ),
  };
  const report = {
    mutate: (input: { id: number; reason: string }) =>
      runAction(
        "report",
        "Отправить жалобу",
        (signal) => utils.client.club.reportComment.mutate(input, { signal }),
        () => window.alert("Жалоба отправлена. Спасибо!"),
      ),
  };
  const toggleLike = {
    isPending: operation.kind === "like",
    mutate: (input: { commentId: number }) =>
      runAction(
        "like",
        "Изменить лайк комментария",
        async (signal) => {
          await utils.club.commentsPage.cancel({ postId });
          if (signal.aborted) throw signal.reason;
          const result = await utils.client.club.toggleCommentLike.mutate(
            input,
            { signal },
          );
          await utils.club.commentsPage.cancel({ postId });
          return result;
        },
        (result) => {
          const confirmed = result as { liked: boolean; likeCount: number };
          cache.setQueriesData<CursorChain<ApiOutputs["club"]["commentsPage"]>>(
            {
              queryKey: getQueryKey(
                trpc.club.commentsPage,
                { postId },
                "query",
              ),
            },
            (chain) =>
              chain && {
                ...chain,
                pages: chain.pages.map((page) => ({
                  ...page,
                  items: page.items.map((row) =>
                    row.id === input.commentId
                      ? {
                          ...row,
                          likedByMe: confirmed.liked,
                          likeCount: confirmed.likeCount,
                        }
                      : row,
                  ),
                })),
              },
          );
        },
        requireCommentLike,
        false,
        async (signal) => {
          await refreshCommentRow(input.commentId, signal);
          await readComments(signal);
        },
      ),
  };
  const tree = useMemo(() => {
    const rows = isAuthenticated && !denied ? comments.items : [];
    const roots = rows.filter((c) => !c.parentId);
    return { roots };
  }, [comments.items, isAuthenticated, denied]);
  if (!community) return null;
  if (denied && isAuthenticated)
    return (
      <ContentRequestState
        error={branchError ?? comments.error}
        notFoundText="Комментарии недоступны"
        onRetry={() => void comments.refetch()}
      />
    );
  const commentCount =
    comments.data?.pages[0]?.totalCount ?? commentCountProp ?? 0;
  const untilLabel = until
    ? until.toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const staff = user?.role === "admin" || user?.role === "moderator";
  const allComments = cache
    .getQueriesData<
      CursorChain<ApiOutputs["club"]["commentsPage"]>
    >({ queryKey: getQueryKey(trpc.club.commentsPage, { postId }, "query"), predicate: (query) => (query.queryKey[2] as { ownerScope?: string })?.ownerScope === commentScope })
    .flatMap(([, chain]) => chain?.pages.flatMap((page) => page.items) ?? []);
  const menuComment =
    allComments.find((row) => row.id === menuCommentId) ?? null;
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
      const row = allComments.find((c) => c.id === id);
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
    if (photos.length >= 2 || composeBlocked) return;
    const task = operation.begin("photos");
    if (!task) return;
    setActionError(null);
    try {
      const selected = await privateFiles.pick(2 - photos.length, task);
      task.assertCurrent();
      setPhotos((prev) => [...prev, ...selected].slice(0, 2));
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) {
        setActionError(getRequestErrorMessage(error));
      }
    } finally {
      task.finish();
    }
  };
  const renderComment = (item: PagedComment, depth = 0) => {
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
                disabled={action.blocked}
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
                disabled={action.blocked}
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
                  disabled={action.blocked}
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
                  disabled={action.blocked || !editText.trim()}
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
              disabled={!isAuthenticated || action.blocked}
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
              <Action
                disabled={composeBlocked}
                onClick={() => setReplyTo(item.id)}
              >
                <Typography className={classes.replyBtn}>Ответить</Typography>
              </Action>
            ) : null}
          </div>
        </div>
        <CommentReplies
          postId={postId}
          parentId={item.id}
          count={item.replyCount}
          depth={depth + 1}
          enabled={commentsEnabled && !denied}
          scope={commentScope}
          render={renderComment}
          onDenied={setBranchError}
          onMissing={(parentId) => void refreshMissingBranch(parentId)}
        />
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
          isError={comments.isError && !comments.isFetchNextPageError}
          onRetry={() => void comments.refetch()}
          message="Не удалось загрузить комментарии"
        />
        {tree.roots.map((item) => renderComment(item))}
        {comments.hasNextPage ? (
          <Action
            disabled={comments.isFetching || comments.isFetchingNextPage}
            onClick={() => void comments.fetchNextPage()}
          >
            <Typography className={classes.replyBtn}>
              {comments.isFetchingNextPage
                ? "Загрузка…"
                : comments.isFetchNextPageError
                  ? "Повторить комментарии"
                  : "Ещё комментарии"}
            </Typography>
          </Action>
        ) : null}
      </div>
      {open && isAuthenticated ? (
        <div
          className={["ui-stack ", classes.commentBlock]
            .filter(Boolean)
            .join(" ")}
        >
          {replyTo ? (
            <Action disabled={composeBlocked} onClick={() => setReplyTo(null)}>
              <Typography className={classes.cancelReply}>
                Отмена ответа
              </Typography>
            </Action>
          ) : null}
          <Field
            disabled={composeBlocked}
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
                    source={{ uri: privateFiles.preview(uri) }}
                    contentFit="cover"
                    className={classes.photo}
                  />
                  <Action
                    disabled={composeBlocked}
                    aria-label="Удалить фото из комментария"
                    onClick={() => {
                      privateFiles.remove(uri);
                      setPhotos((prev) => prev.filter((p) => p !== uri));
                    }}
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
              disabled={
                composeBlocked ||
                photos.length >= 2 ||
                !capabilities.privateContentUploads
              }
              title={
                !capabilities.privateContentUploads
                  ? uploadUnavailableMessage
                  : undefined
              }
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
              disabled={composeBlocked || !text.trim()}
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
      {privateFiles.error ? (
        <Typography role="alert" className={classes.error}>
          {privateFiles.error}
        </Typography>
      ) : null}
      {pendingPrivate && !operation.busy ? (
        <div className="ui-stack">
          <Typography role="alert" className={classes.error}>
            На устройстве сохранена отправка комментария.
          </Typography>
          <Action
            disabled={operation.busy}
            onClick={() => {
              const restored = privateFiles.restore();
              if (!restored) return;
              setText(restored.record.text);
              setPhotos(restored.photos);
              setReplyTo(restored.record.parentId ?? null);
            }}
          >
            Восстановить отправку
          </Action>
          <Action
            disabled={operation.busy}
            onClick={() => void sendPrivate(pendingPrivate)}
          >
            Повторить отправку
          </Action>
          <Action
            disabled={operation.busy}
            onClick={() => void readOrDiscardPrivate(false)}
          >
            Обновить комментарии
          </Action>
          <Action
            disabled={operation.busy}
            onClick={() => {
              if (
                window.confirm(
                  "Отказаться от сохранённой отправки? Уже отправленный комментарий останется в списке.",
                )
              )
                void readOrDiscardPrivate(true);
            }}
          >
            Отказаться от неподтверждённой отправки
          </Action>
        </div>
      ) : null}
      {action.unknown && !operation.busy ? (
        <div className="ui-stack">
          <Typography role="alert" className={classes.error}>
            Результат действия «{action.unknown.label}» не подтверждён.
          </Typography>
          <Action disabled={operation.busy} onClick={() => void action.check()}>
            Обновить комментарии
          </Action>
          {action.unknown.keepBlocked ? (
            <Action
              onClick={() => {
                if (
                  !window.confirm(
                    "Вы проверили список? Отказаться от неподтверждённой отправки и очистить этот текст и фото? Уже отправленный комментарий останется в списке.",
                  )
                )
                  return;
                setText("");
                setPhotos([]);
                setReplyTo(null);
                privateFiles.reset();
                action.discard();
              }}
            >
              Отказаться от неподтверждённой отправки
            </Action>
          ) : null}
        </div>
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
