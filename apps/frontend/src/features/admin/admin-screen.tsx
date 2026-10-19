"use client";
import classes from "./admin-screen.module.scss";
import {
  Typography,
  Action,
  ScrollArea,
  Spinner,
  Collection,
} from "@/shared/ui/elements";
import { useEffect, useState } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { trpc } from "@/shared/api/trpc";
import type { AdminPost } from "@/shared/api/types";
import { useRouter } from "@/shared/navigation/router";

import { CalendarTracker } from "@/features/admin/calendar-tracker";
import { StatsDashboard } from "@/features/admin/stats-dashboard";

import { VkCatalogAdmin } from "./vk-catalog-admin";
import { isVkCatalogEnabled } from "@/features/videos/catalog-api";
import { ArticlesAdmin } from "@/features/admin/articles-admin";
import { SeasonSettings } from "@/features/admin/season-settings";
import { MemberAccessEmail } from "./member-access-email";
import {
  canResendAccessEmail,
  useAccessEmailResend,
} from "./use-access-email-resend";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";

import { useConfirmedAction } from "@/domain/session/use-confirmed-action";
import {
  requireOk,
  requireGrant,
  requireAbsentId,
  requireIdList,
} from "@/shared/api/action-result";
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
  const adminActions = useConfirmedAction(staff && !showForm);
  const accessEmail = useAccessEmailResend(
    isOwner && viewTab === "members" && !showForm,
  );
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
  const membersQuery = trpc.admin.members.useQuery(undefined, {
    enabled: isOwner && (viewTab === "members" || viewTab === "payments"),
  });
  const paymentsQuery = trpc.admin.payments.useQuery(undefined, {
    enabled: isOwner && viewTab === "payments",
  });
  const reportsQuery = trpc.moderation.listCommentReports.useQuery(undefined, {
    enabled: staff && viewTab === "reports",
  });
  const mutation = <T,>(
    kind: string,
    label: string,
    perform: (input: T, signal: AbortSignal) => Promise<unknown>,
    read: () => Promise<void>,
    commit: (result: unknown) => void,
    validate = requireOk,
  ) => ({
    isPending: adminActions.blocked,
    mutate: (input: T) =>
      void adminActions.run({
        kind,
        label,
        perform: (signal) => perform(input, signal),
        read,
        commit,
        validate,
      }),
  });
  const readMembers = () => readQuery(membersQuery);
  const readReports = () => readQuery(reportsQuery);
  const deleteMutation = mutation(
    "delete-post",
    "Удалить пост",
    async (input: { id: number }, signal) => {
      await utils.client.admin.deletePost.mutate(input, { signal });
      const result = await postsQuery.refetch();
      if (!result.isSuccess || !Array.isArray(result.data))
        throw result.error ?? invalidResponse();
      requireAbsentId(result.data, input.id);
      return { ok: true };
    },
    () => readQuery(postsQuery),
    () => invalidatePublicFeeds(),
  );
  const grantClub = mutation(
    "grant",
    "Продлить клуб",
    (input: { userId: number }, signal) =>
      utils.client.admin.grantClub.mutate(input, { signal }),
    readMembers,
    (result) => {
      void membersQuery.refetch();
      void paymentsQuery.refetch();
      const until = new Date(
        (result as { expiresAt: string }).expiresAt,
      ).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      window.alert(`Клуб продлён до ${until}`);
    },
    requireGrant,
  );
  const blockUser = mutation(
    "block",
    "Заблокировать пользователя",
    (input: { userId: number; reason: string }, signal) =>
      utils.client.moderation.blockUser.mutate(input, { signal }),
    isOwner && viewTab === "members" ? readMembers : readReports,
    () => {
      if (isOwner) void membersQuery.refetch();
      void reportsQuery.refetch();
    },
  );
  const unblockUser = mutation(
    "unblock",
    "Разблокировать пользователя",
    (input: { userId: number }, signal) =>
      utils.client.moderation.unblockUser.mutate(input, { signal }),
    readMembers,
    () => void membersQuery.refetch(),
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
      void utils.club.list.invalidate();
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
  const handleCreate = () => {
    setEditingPost(null);
    setScheduledDate(null);
    setShowForm(true);
  };
  const handleEdit = (post: AdminPost) => {
    setEditingPost(post);
    setScheduledDate(null);
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
          disabled={adminActions.blocked}
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
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {adminActions.error ? (
        <Typography role="alert" className={classes.loadingText}>
          {adminActions.error}
        </Typography>
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
              {posts?.length || 0}
            </Typography>
            <Typography className={classes.formHint}>Всего</Typography>
          </div>
          <div
            className={["ui-stack ", classes.statItem]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.statNumber}>
              {posts?.filter((p) => p.published).length || 0}
            </Typography>
            <Typography className={classes.formHint}>Опубликовано</Typography>
          </div>
          <div
            className={["ui-stack ", classes.statItem]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.statNumber}>
              {posts?.filter((p) => p.status === "scheduled").length || 0}
            </Typography>
            <Typography className={classes.formHint}>Отложено</Typography>
          </div>
          <div
            className={["ui-stack ", classes.statItem]
              .filter(Boolean)
              .join(" ")}
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
      ) : null}
      {isOwner ? (
        <>
          {/* View tabs */}
          <div
            className={["ui-stack ", classes.viewTabs]
              .filter(Boolean)
              .join(" ")}
          >
            {viewTab === "posts" || viewTab === "calendar" ? (
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
                <MaterialIcons name="add" size={18} color={CREAM_BG} />
                <Typography className={classes.submitBtnText}>Новый</Typography>
              </Action>
            ) : null}
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
        </>
      ) : null}

      {selectedListQuery?.isError ? (
        <QueryRetryState
          isLoading={false}
          isError
          onRetry={() => void selectedListQuery.refetch()}
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
            posts={posts}
            isLoading={postsQuery.isLoading}
            isError={postsQuery.isError}
            onRetry={() => void postsQuery.refetch()}
            onPostPress={(post) => {
              handleEdit(post);
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
                  disabled={grantClub.isPending || accessEmail.busy}
                  className={classes.action}
                >
                  <Typography className={classes.grantBtnText}>
                    {item.clubExpiresAt ? "Продлить клуб" : "Выдать клуб"}
                  </Typography>
                </Action>
                {item.blockedAt ? (
                  <Action
                    onClick={() => unblockUser.mutate({ userId: item.id })}
                    disabled={unblockUser.isPending || accessEmail.busy}
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
                    disabled={blockUser.isPending || accessEmail.busy}
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
                    disabled={adminActions.blocked || accessEmail.busy}
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
