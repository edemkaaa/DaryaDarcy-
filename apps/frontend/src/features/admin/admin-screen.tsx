"use client";
import { CursorPagePrevious } from "@/shared/ui/cursor-page-previous";
import classes from "./admin-screen.module.scss";
import {
  Typography,
  Action,
  ScrollArea,
  Spinner,
  Collection,
} from "@/shared/ui/elements";
import { useEffect, useMemo, useState } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { trpc } from "@/shared/api/trpc";
import type { AdminPost, AdminPostCard, ApiOutputs } from "@/shared/api/types";
import { getQueryKey } from "@trpc/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCursorPages,
  requireCursorPage,
} from "@/shared/api/use-cursor-pages";
import type { CursorChain } from "@/shared/api/cursor-pages";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { getRequestErrorMessage, getHttpStatus } from "@/shared/api/errors";
import { useRouter } from "@/shared/navigation/router";

import { CalendarTracker } from "@/features/admin/calendar-tracker";
import { StatsDashboard } from "@/features/admin/stats-dashboard";

import { VkCatalogAdmin } from "./vk-catalog-admin";
import { isVkCatalogEnabled } from "@/features/videos/catalog-api";
import { ArticlesAdmin } from "@/features/admin/articles-admin";
import { SeasonSettings } from "@/features/admin/season-settings";
import { MemberAccessEmail } from "./member-access-email";
import { useAdminActionRecovery } from "./use-admin-action-recovery";
import { AdminActionRecoveryNotice } from "./admin-action-recovery-notice";
import {
  canResendAccessEmail,
  useAccessEmailResend,
} from "./use-access-email-resend";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";

import { useConfirmedAction } from "@/domain/session/use-confirmed-action";
import { requireOk, requireIdList } from "@/shared/api/action-result";
import { invalidResponse } from "@/shared/api/errors";

import {
  CREAM_BG,
  BROWN_LIGHT,
  GREEN_ACCENT,
  ALL_TAGS,
} from "./admin-screen.content";

import { AdminPostEditor } from "./admin-post-editor";
export default function AdminScreen() {
  const router = useRouter();
  const {
    user,
    isOwner,
    isAuthenticated,
    loading: authLoading,
    error: sessionError,
    status: sessionStatus,
  } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<AdminPost | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [ownerViewTab, setViewTab] = useState<
    | "posts"
    | "calendar"
    | "stats"
    | "members"
    | "payments"
    | "videos"
    | "articles"
    | "reports"
    | "seasons"
  >("posts");
  const staff = isOwner || user?.role === "moderator";
  useEffect(() => {
    if (sessionStatus === "guest") router.login("/admin", true);
  }, [router, sessionStatus]);
  const viewTab = isOwner ? ownerViewTab : "reports";
  const adminActions = useConfirmedAction(staff && !showForm, viewTab);
  const detailRead = useSessionOperation(isOwner && !showForm, viewTab);
  const readQuery = async (query: {
    refetch: () => Promise<{
      isSuccess: boolean;
      error: unknown;
      data: unknown;
    }>;
  }) => {
    const result = await query.refetch();
    if (!result.isSuccess || !Array.isArray(result.data))
      throw result.error ?? invalidResponse();
    requireIdList(result.data);
  };
  const postsQuery = trpc.admin.postsPage.useInfiniteQuery(
    { limit: 20 },
    {
      enabled: isOwner && viewTab === "posts" && !showForm,
      maxPages: 8,
      getPreviousPageParam: (_firstPage, _pages, firstParam) =>
        typeof firstParam === "number" && firstParam > 0
          ? Math.max(0, firstParam - 20)
          : undefined,
      getNextPageParam: (lastPage, _pages, lastParam, params) =>
        lastPage.nextCursor !== null &&
        lastPage.nextCursor > (typeof lastParam === "number" ? lastParam : 0) &&
        !params.includes(lastPage.nextCursor)
          ? lastPage.nextCursor
          : undefined,
      staleTime: 30_000,
    },
  );
  const { isLoading } = postsQuery;
  const posts = useMemo(
    () =>
      Array.from(
        new Map(
          (postsQuery.data?.pages.flatMap((page) => page.posts) ?? []).map(
            (post) => [post.id, post],
          ),
        ).values(),
      ),
    [postsQuery.data],
  );
  const countsQuery = trpc.admin.postCounts.useQuery(undefined, {
    enabled: isOwner,
    staleTime: 30_000,
  });
  const counts = countsQuery.isError ? undefined : countsQuery.data;
  const utils = trpc.useUtils();
  const cache = useQueryClient();
  const invalidatePublicFeeds = () => {
    void utils.admin.postsPage.invalidate();
    void utils.admin.postCounts.invalidate();
    void utils.admin.postCalendar.invalidate();
    void utils.admin.stats.invalidate();
    void utils.feed.list.invalidate();
    void utils.feed.listPaginated.invalidate();
    void utils.club.listByCategory.invalidate();
  };
  const membersQuery = useCursorPages({
    key: getQueryKey(trpc.admin.membersPage, { limit: 20 }, "query"),
    scope: String(user?.id ?? "guest"),
    enabled: isOwner && viewTab === "members" && !showForm,
    fetchPage: (cursor, signal) =>
      utils.client.admin.membersPage.query({ limit: 20, cursor }, { signal }),
  });
  const paymentsQuery = useCursorPages({
    key: getQueryKey(trpc.admin.paymentsPage, { limit: 20 }, "query"),
    scope: String(user?.id ?? "guest"),
    enabled: isOwner && viewTab === "payments" && !showForm,
    poll: false,
    fetchPage: (cursor, signal) =>
      utils.client.admin.paymentsPage.query({ limit: 20, cursor }, { signal }),
  });
  const reportsQuery = trpc.moderation.listCommentReports.useQuery(undefined, {
    enabled: staff && viewTab === "reports",
  });
  const mutation = <T,>(
    kind: string,
    label: string,
    perform: (input: T, signal: AbortSignal) => Promise<unknown>,
    read: (input: T, signal: AbortSignal) => Promise<void>,
    commit: (result: unknown) => void,
    validate = requireOk,
  ) => ({
    isPending: adminActions.blocked,
    mutate: (input: T) =>
      void adminActions.run({
        kind,
        label,
        perform: (signal) => perform(input, signal),
        read: (signal) => read(input, signal),
        commit,
        validate,
      }),
  });
  const readMembers = async (
    input: { userId: number },
    signal: AbortSignal,
  ) => {
    const page = await utils.client.admin.membersPage.query(
      { userId: input.userId, limit: 1 },
      { signal },
    );
    signal.throwIfAborted();
    requireCursorPage(page);
    const member = page.items.find((row) => row.id === input.userId);
    if (page.items.length !== 1 || !member || page.nextCursor !== null)
      throw invalidResponse();
    cache.setQueriesData<CursorChain<ApiOutputs["admin"]["membersPage"]>>(
      { queryKey: getQueryKey(trpc.admin.membersPage) },
      (chain) =>
        chain && {
          ...chain,
          pages: chain.pages.map((current) => ({
            ...current,
            items: current.items.map((row) =>
              row.id === member.id ? member : row,
            ),
          })),
        },
    );
  };
  const readReports = () => readQuery(reportsQuery);
  const memberActions = useAdminActionRecovery(
    isOwner && viewTab === "members" && !showForm,
    async (outcome, signal) => {
      if (outcome.state !== "succeeded" || outcome.kind !== "grantClub") return;
      await readMembers(outcome, signal);
      signal.throwIfAborted();
      void utils.admin.paymentsPage.invalidate();
    },
  );
  const accessEmail = useAccessEmailResend(memberActions);
  const deleteMutation = mutation(
    "delete-post",
    "Удалить пост",
    async (input: { id: number }, signal) => {
      await utils.client.admin.deletePost.mutate(input, { signal });
      const result = await utils.client.admin.postDetail.query(input, {
        signal,
      });
      if (result !== null) throw invalidResponse();
      return { ok: true };
    },
    async (input, signal) => {
      const detail = await utils.client.admin.postDetail.query(input, {
        signal,
      });
      if (detail !== null) throw invalidResponse();
      const result = await postsQuery.refetch();
      if (!result.isSuccess || !result.data)
        throw result.error ?? invalidResponse();
      requireIdList(result.data.pages.flatMap((page) => page.posts));
    },
    () => invalidatePublicFeeds(),
  );
  const blockUser = mutation(
    "block",
    "Заблокировать пользователя",
    async (input: { userId: number; reason: string }, signal) => {
      const result = await utils.client.moderation.blockUser.mutate(input, {
        signal,
      });
      requireOk(result);
      if (isOwner && viewTab === "members") await readMembers(input, signal);
      return result;
    },
    isOwner && viewTab === "members" ? readMembers : readReports,
    () => {
      void reportsQuery.refetch();
    },
  );
  const unblockUser = mutation(
    "unblock",
    "Разблокировать пользователя",
    async (input: { userId: number }, signal) => {
      const result = await utils.client.moderation.unblockUser.mutate(input, {
        signal,
      });
      requireOk(result);
      await readMembers(input, signal);
      return result;
    },
    readMembers,
    () => {},
  );
  const dismissReport = mutation(
    "dismiss",
    "Закрыть жалобу",
    (input: { reportId: number }, signal) =>
      utils.client.moderation.dismissCommentReport.mutate(input, { signal }),
    readReports,
    () => void reportsQuery.refetch(),
  );
  const deleteReportedComment = mutation(
    "delete-comment",
    "Удалить комментарий",
    (input: { commentId: number; reportId: number }, signal) =>
      utils.client.moderation.deleteReportedComment.mutate(input, { signal }),
    readReports,
    () => {
      void reportsQuery.refetch();
      void utils.club.comments.invalidate();
      void utils.club.commentsPage.invalidate();
      void utils.club.listByCategory.invalidate();
    },
  );
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
  const listFailed =
    Boolean(selectedListQuery?.isError) &&
    !(
      viewTab === "payments" &&
      !paymentsQuery.denied &&
      (paymentsQuery.isFetchNextPageError || paymentsQuery.items.length > 0)
    ) &&
    !(
      viewTab === "members" &&
      !membersQuery.denied &&
      (membersQuery.isFetchNextPageError ||
        membersQuery.isFetchPreviousPageError)
    ) &&
    !(
      viewTab === "posts" &&
      ![401, 403, 404].includes(getHttpStatus(postsQuery.error) ?? 0) &&
      (postsQuery.isFetchNextPageError || postsQuery.isFetchPreviousPageError)
    );
  const handleCreate = () => {
    setEditingPost(null);
    setScheduledDate(null);
    setShowForm(true);
  };
  const handleEdit = async (post: { id: number }) => {
    const task = detailRead.begin("post-detail");
    if (!task) return;
    adminActions.setError(null);
    try {
      const full = await utils.client.admin.postDetail.query(
        { id: post.id },
        { signal: task.signal },
      );
      task.assertCurrent();
      if (!full || full.id !== post.id || !Array.isArray(full.media))
        throw invalidResponse();
      setEditingPost(full);
      setScheduledDate(null);
      setShowForm(true);
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        adminActions.setError(getRequestErrorMessage(error));
    } finally {
      task.finish();
    }
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
      if (!adminActions.blocked && !memberActions.blocked && confirm(message))
        void memberActions.start("grantClub", userId);
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
  // ── Post list item ──
  const renderPostItem = ({
    item,
    index,
  }: {
    item: AdminPostCard;
    index: number;
  }) => (
    <div
      data-testid={`admin-post-${item.id}`}
      className={[
        "ui-stack",
        classes.postItem,
        index === 0 ? classes.firstPost : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
            sizes="56px"
          />
        )}
        {!(item.photos && (item.photos as string[]).length > 0) &&
          item.hasVideo && (
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
            {item.tagCount > 3 && (
              <Typography className={classes.moreTagsText}>
                +{item.tagCount - 3}
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
          disabled={adminActions.blocked || detailRead.busy}
          onClick={() => void handleEdit(item)}
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
          disabled={deleteMutation.isPending}
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
  if (sessionError || sessionStatus === "logout-error")
    return <SessionStatus />;
  if (authLoading || sessionStatus === "guest") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <div
          className={["ui-stack ", classes.loadingContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <LoadingIndicator label="Проверяем доступ…" />
        </div>
      </ScreenContainer>
    );
  }
  if (!isAuthenticated || !staff) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <div
          className={["ui-stack ", classes.loadingContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="lock-outline" size={40} color={BROWN_LIGHT} />
          <Typography className={classes.loadingText}>
            Недостаточно прав для управления приложением
          </Typography>
          <Action
            onClick={() => router.replace("/profile")}
            className={classes.newPostBtn}
          >
            <Typography className={classes.submitBtnText}>
              Вернуться в профиль
            </Typography>
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
          <ContentPlaceholder kind="feed" />
        </div>
      </ScreenContainer>
    );
  }
  return (
    <ScreenContainer
      edges={["top", "bottom", "left", "right"]}
      scrollable={listFailed}
    >
      {adminActions.error ? (
        <Typography role="alert" className={classes.loadingText}>
          {adminActions.error}
        </Typography>
      ) : null}
      {isOwner && viewTab === "members" && listFailed ? (
        <AdminActionRecoveryNotice recovery={memberActions} />
      ) : null}
      {countsQuery.isError && isOwner ? (
        <Action
          onClick={() => void countsQuery.refetch()}
          className={classes.formHint}
        >
          Повторить счётчики
        </Action>
      ) : null}
      {adminActions.unknown && !adminActions.operation.busy ? (
        <Action
          onClick={() => void adminActions.check()}
          className={classes.newPostBtn}
        >
          Обновить список
        </Action>
      ) : null}
      {isOwner ? (
        <div
          className={["ui-stack ", classes.statsRow].filter(Boolean).join(" ")}
        >
          <div
            className={["ui-stack ", classes.statItem]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.statNumber}>
              {counts?.total ?? "—"}
            </Typography>
            <Typography className={classes.formHint}>Всего</Typography>
          </div>
          <div
            className={["ui-stack ", classes.statItem]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.statNumber}>
              {counts?.published ?? "—"}
            </Typography>
            <Typography className={classes.formHint}>Опубликовано</Typography>
          </div>
          <div
            className={["ui-stack ", classes.statItem]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.statNumber}>
              {counts?.scheduled ?? "—"}
            </Typography>
            <Typography className={classes.formHint}>Отложено</Typography>
          </div>
          <div
            className={["ui-stack ", classes.statItem]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.statNumber}>
              {counts?.draft ?? "—"}
            </Typography>
            <Typography className={classes.formHint}>Черновики</Typography>
          </div>
        </div>
      ) : null}
      {isOwner ? (
        <>
          {/* View tabs */}
          <div
            role="group"
            aria-label="Разделы админки"
            className={["ui-stack ", classes.viewTabs]
              .filter(Boolean)
              .join(" ")}
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
                  viewTab === "posts"
                    ? classes.colorState13
                    : classes.colorState14,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Посты
              </Typography>
            </Action>
            {isVkCatalogEnabled() ? (
              <Action
                onClick={() => setViewTab("videos")}
                className={[
                  classes.viewTabActive,
                  viewTab === "videos"
                    ? classes.backgroundColorState11
                    : classes.backgroundColorState12,
                ].join(" ")}
              >
                <MaterialIcons
                  name="video-library"
                  size={16}
                  color={viewTab === "videos" ? CREAM_BG : BROWN_LIGHT}
                />
                <Typography
                  className={[
                    classes.targetChipTextActive,
                    viewTab === "videos"
                      ? classes.colorState15
                      : classes.colorState16,
                  ].join(" ")}
                >
                  Видео
                </Typography>
              </Action>
            ) : null}
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
                  viewTab === "stats"
                    ? classes.colorState19
                    : classes.colorState20,
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
            <Action
              onClick={() => setViewTab("seasons")}
              className={[
                classes.viewTabActive,
                viewTab === "seasons"
                  ? classes.backgroundColorState21
                  : classes.backgroundColorState22,
              ].join(" ")}
            >
              <Typography
                className={[
                  classes.targetChipTextActive,
                  viewTab === "seasons"
                    ? classes.colorState25
                    : classes.colorState26,
                ].join(" ")}
              >
                Сезоны
              </Typography>
            </Action>
          </div>
          {viewTab === "posts" || viewTab === "calendar" ? (
            <div className={`ui-stack ${classes.sectionToolbar}`}>
              <Action
                onClick={handleCreate}
                disabled={adminActions.blocked}
                className={({ pressed }) =>
                  [
                    classes.newPostBtn,
                    classes.createPost,
                    pressed ? classes.opacityState16 : classes.opacityState17,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <MaterialIcons name="add" size={16} color={CREAM_BG} />
                <Typography className={classes.submitBtnText}>
                  Новый пост
                </Typography>
              </Action>
            </div>
          ) : null}
        </>
      ) : null}

      {listFailed ? (
        <QueryRetryState
          isLoading={false}
          isError
          onRetry={() =>
            void (viewTab === "payments"
              ? paymentsQuery.restart()
              : selectedListQuery?.refetch())
          }
          message="Не удалось загрузить список"
        />
      ) : viewTab === "seasons" ? (
        <SeasonSettings />
      ) : viewTab === "videos" ? (
        <VkCatalogAdmin />
      ) : viewTab === "articles" ? (
        <ArticlesAdmin />
      ) : viewTab === "calendar" ? (
        <ScrollArea
          className={classes.formScroll}
          contentClassName={classes.scrollAreacontent}
        >
          <CalendarTracker
            active={!showForm}
            onPostPress={(post) => {
              void handleEdit(post);
            }}
            onDayPress={(date) => {
              setEditingPost(null);
              setScheduledDate(date);
              setShowForm(true);
            }}
          />
        </ScrollArea>
      ) : viewTab === "stats" ? (
        <StatsDashboard />
      ) : viewTab === "members" ? (
        <Collection
          data={membersQuery.items}
          preserveScroll
          header={
            <>
              <AdminActionRecoveryNotice recovery={memberActions} />
              <CursorPagePrevious
                query={membersQuery}
                label="Предыдущие участницы"
              />
            </>
          }
          footer={
            membersQuery.hasNextPage && !membersQuery.denied ? (
              <Action
                disabled={
                  membersQuery.isFetching || membersQuery.isFetchingNextPage
                }
                onClick={() => void membersQuery.fetchNextPage()}
                className={classes.postsRetry}
              >
                <Typography>
                  {membersQuery.isFetchingNextPage
                    ? "Загрузка…"
                    : membersQuery.isFetchNextPageError
                      ? "Повторить загрузку участниц"
                      : "Загрузить ещё участниц"}
                </Typography>
              </Action>
            ) : null
          }
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
                  disabled={adminActions.blocked || memberActions.blocked}
                  className={classes.action}
                >
                  <Typography className={classes.grantBtnText}>
                    {item.clubExpiresAt ? "Продлить клуб" : "Выдать клуб"}
                  </Typography>
                </Action>
                {item.blockedAt ? (
                  <Action
                    onClick={() => unblockUser.mutate({ userId: item.id })}
                    disabled={unblockUser.isPending || memberActions.blocked}
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
                    disabled={blockUser.isPending || memberActions.blocked}
                    className={classes.action}
                  >
                    <Typography className={classes.typography}>
                      Заблокировать
                    </Typography>
                  </Action>
                ) : null}
                {canResendAccessEmail(item) ? (
                  <MemberAccessEmail
                    member={item}
                    result={accessEmail.results[item.id]}
                    pending={
                      accessEmail.pendingId === `access-email-${item.id}`
                    }
                    disabled={
                      adminActions.blocked ||
                      memberActions.blocked ||
                      memberActions.cooldown
                    }
                    onSend={accessEmail.send}
                  />
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
                {item.canBlockAuthor === true &&
                item.authorUserId &&
                item.authorUserId !== user?.id ? (
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
          data={paymentsQuery.items}
          preserveScroll
          header={
            <>
              <CursorPagePrevious
                query={paymentsQuery}
                label="Предыдущие оплаты"
              />
              <Typography className={classes.postItemDate}>
                История оплат. Более ранние записи загружаются при прокрутке.
              </Typography>
              <QueryRetryState
                isLoading={false}
                isError={
                  paymentsQuery.isError &&
                  !paymentsQuery.isFetchNextPageError &&
                  !paymentsQuery.isFetchPreviousPageError
                }
                onRetry={() => void paymentsQuery.restart()}
                message="Не удалось обновить историю оплат"
              />
            </>
          }
          onRefresh={() => void paymentsQuery.restart()}
          refreshing={paymentsQuery.isRefetching}
          onLoadMore={
            paymentsQuery.hasNextPage &&
            !paymentsQuery.isFetching &&
            !paymentsQuery.isFetchingNextPage &&
            !paymentsQuery.isError &&
            !showForm
              ? () => void paymentsQuery.fetchNextPage()
              : undefined
          }
          footer={
            <QueryRetryState
              isLoading={paymentsQuery.isFetchingNextPage}
              isError={paymentsQuery.isFetchNextPageError}
              onRetry={() => void paymentsQuery.fetchNextPage()}
              message="Не удалось загрузить следующие оплаты"
              loadingSize="small"
            />
          }
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
          preserveScroll
          header={
            <CursorPagePrevious
              query={postsQuery}
              label="Предыдущие публикации"
            />
          }
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id.toString()}
          hideScrollbar
          onLoadMore={
            postsQuery.hasNextPage &&
            !postsQuery.isFetching &&
            !postsQuery.isError &&
            !showForm
              ? () => void postsQuery.fetchNextPage()
              : undefined
          }
          footer={
            postsQuery.isFetchNextPageError || postsQuery.isFetchingNextPage ? (
              <div className={`ui-stack ${classes.postsFooter}`}>
                {postsQuery.isFetchingNextPage ? (
                  <Spinner color={GREEN_ACCENT} />
                ) : (
                  <Action
                    onClick={() => void postsQuery.fetchNextPage()}
                    className={classes.postsRetry}
                  >
                    <Typography>Повторить загрузку</Typography>
                  </Action>
                )}
              </div>
            ) : null
          }
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
          contentClassName={`${classes.listContent} ${classes.postsListContent}`}
        />
      )}

      {showForm ? (
        <AdminPostEditor
          key={editingPost?.id ?? "new"}
          post={editingPost}
          scheduledDate={scheduledDate}
          onClose={() => setShowForm(false)}
          onSaved={invalidatePublicFeeds}
        />
      ) : null}
    </ScreenContainer>
  );
}
