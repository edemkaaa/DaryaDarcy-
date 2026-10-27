"use client";
import { useBrowserReady } from "@/shared/browser/use-browser-ready";
import classes from "./feed-screen.module.scss";
import {
  Field,
  Action,
  Typography,
  ScrollArea,
  Collection,
} from "@/shared/ui/elements";
import { PostCard } from "./post-card";
import { GridItem } from "./feed-grid-item";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { postDisplayDate } from "@/domain/post/post-date";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import { ScreenContainer } from "@/shared/ui/screen-container";

import { getQueryKey } from "@trpc/react-query";
import { useCursorPages } from "@/shared/api/use-cursor-pages";
import { POST_PAGE_WINDOW } from "@/shared/api/cursor-pages";
import { invalidResponse } from "@/shared/api/errors";
import { trpc } from "@/shared/api/trpc";
import type { ApiOutputs } from "@/shared/api/types";
import { contentRefreshOptions } from "@/shared/api/content-refresh";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { useRouter } from "@/shared/navigation/router";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { usePostInteractions } from "@/domain/post/use-post-interactions";
import { PostInteractionStatus } from "@/domain/post/post-interaction-status";

import { PhotoViewer } from "@/shared/media/photo-viewer";
import { usePostManagement } from "@/features/admin/post-management";
import { useAuth } from "@/domain/session/session-context";

import { ScrollToTopButton } from "@/shared/ui/scroll-to-top-button";
import { AdminFAB } from "@/features/admin/admin-fab";
import { articleIdFromSource } from "@/domain/content/article-blocks";
import { sanitizePhotoUrls } from "@/shared/media/photo-urls";
import { sanitizeRichTextForDisplay } from "@/domain/content/post-text-sanitize";
import {
  GRID_COLUMNS,
  CREAM_BG,
  BROWN_LIGHT,
  DEFAULT_TAGS,
  FEED_BANNER_URI,
} from "./feed-screen.content";
import type { TagSlug, Tag, FeedPost } from "./feed-screen.content";
type ViewMode = "feed" | "grid";
function formatDate(date: Date | string, browserCalendar: boolean): string {
  const d = new Date(date);
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  return `${browserCalendar ? d.getDate() : d.getUTCDate()} ${months[browserCalendar ? d.getMonth() : d.getUTCMonth()]} ${browserCalendar ? d.getFullYear() : d.getUTCFullYear()}`;
}
function normalizeFeedPost(
  p: ApiOutputs["feed"]["listPaginated"]["posts"][number],
  browserCalendar: boolean,
): FeedPost {
  const photos = sanitizePhotoUrls(p.photos);
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const text = typeof p.text === "string" ? p.text : "";
  const richText = sanitizeRichTextForDisplay(p.richText);
  const media = Array.isArray(p.media) ? p.media : undefined;
  const targetRaw = p.target;
  const target =
    targetRaw === "club" || targetRaw === "both" || targetRaw === "feed"
      ? targetRaw
      : "feed";
  return {
    id: Number(p.id),
    text,
    photos,
    tags,
    date: (() => {
      const d = postDisplayDate(p);
      return d ? formatDate(d, browserCalendar) : "";
    })(),
    likeCount: typeof p.likeCount === "number" ? p.likeCount : 0,
    media,
    richText,
    publishedAt: p.publishedAt ?? p.createdAt ?? null,
    createdAt: p.createdAt ?? null,
    target,
    articleId: articleIdFromSource(
      typeof p.source === "string" ? p.source : null,
    ),
  };
}
export default function FeedScreen() {
  const active = useScreenActive();
  const browserCalendar = useBrowserReady();
  const router = useRouter();
  const { user, isOwner } = useAuth();
  const [selectedTag, setSelectedTag] = useState<TagSlug>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Photo viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const utils = trpc.useUtils();
  const feedFilters = {
    tag: selectedTag === "all" ? undefined : selectedTag,
    search: debouncedSearch || undefined,
    limit: 12,
  };
  const feedQuery = useCursorPages({
    key: getQueryKey(trpc.feed.listPaginated, feedFilters, "query"),
    scope: String(user?.id ?? "guest"),
    enabled: active,
    staleTime: 30_000,
    gcTime: 60_000,
    window: POST_PAGE_WINDOW,
    fetchPage: async (cursor, signal) => {
      const page = await utils.client.feed.listPaginated.query(
        {
          ...feedFilters,
          ...(cursor === null ? {} : { cursor: Number(cursor) }),
        },
        { signal },
      );
      if (
        page.nextCursor !== null &&
        (!Number.isSafeInteger(page.nextCursor) || page.nextCursor < 0)
      )
        throw invalidResponse();
      return {
        items: page.posts,
        nextCursor: page.nextCursor === null ? null : String(page.nextCursor),
      };
    },
  });
  const {
    data: paginatedData,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isFetchNextPageError,
    isRefetchError,
  } = feedQuery;
  useBackgroundNotice({
    when: isRefetchError && paginatedData !== undefined,
    message: "Не удалось обновить ленту",
    onRetry: () => refetch({ cancelRefetch: false }),
  });
  // Fetch tags from API
  const { data: apiTags } = trpc.feed.tags.useQuery(undefined, {
    staleTime: 30_000,
    ...contentRefreshOptions(active),
  });
  // Use API data or fallback to mock
  const TAGS: Tag[] = useMemo(() => {
    if (apiTags && apiTags.length > 0) {
      return [
        { slug: "all" as TagSlug, label: "Все" },
        ...apiTags.map((t) => ({ slug: t.slug as TagSlug, label: t.label })),
      ];
    }
    return DEFAULT_TAGS;
  }, [apiTags]);
  const posts: FeedPost[] = useMemo(
    () =>
      feedQuery.items
        .filter((post) => post.target !== "club")
        .map((post) => normalizeFeedPost(post, browserCalendar)),
    [feedQuery.items, browserCalendar],
  );
  const interactions = usePostInteractions(posts.map((post) => post.id));
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);
  const handleTagPress = (slug: TagSlug) => {
    setSelectedTag(slug);
  };
  const handleLike = (postId: number) => {
    if (!user) {
      router.login("/feed");
      return;
    }
    interactions.like(postId);
  };
  const handleSave = (postId: number) => {
    if (!user) {
      router.login("/feed");
      return;
    }
    interactions.save(postId);
  };
  const openViewer = useCallback((photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  }, []);
  const closeViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);
  // ── Seasonal Banner ──
  const renderBanner = () => (
    <div
      className={["ui-stack ", classes.bannerContainer]
        .filter(Boolean)
        .join(" ")}
    >
      <Picture
        source={{ uri: FEED_BANNER_URI }}
        loading="eager"
        fetchPriority="high"
        contentFit="cover"
        transition={300}
        className={classes.bannerImage}
      />
    </div>
  );
  // ── Search Bar + View Toggle (same row) ──
  const renderSearchRow = () => (
    <div className={["ui-stack ", classes.searchRow].filter(Boolean).join(" ")}>
      <div
        className={["ui-stack ", classes.searchContainer]
          .filter(Boolean)
          .join(" ")}
      >
        <MaterialIcons name="search" size={18} color={BROWN_LIGHT} />
        <Field
          aria-label="Поиск по ленте"
          placeholder="Поиск..."
          placeholderColor={BROWN_LIGHT}
          value={searchQuery}
          onValueChange={setSearchQuery}
          className={classes.searchInput}
        />
        {searchQuery.length > 0 && (
          <Action
            aria-label="Очистить поиск"
            onClick={() => setSearchQuery("")}
            className={({ pressed }) =>
              pressed ? classes.opacityState : classes.opacityState2
            }
          >
            <MaterialIcons name="close" size={18} color={BROWN_LIGHT} />
          </Action>
        )}
      </div>
      {viewMode === "grid" && (
        <Action
          onClick={() => router.push("/videos")}
          className={classes.videoFilterButton}
        >
          <MaterialIcons
            name="play-circle-filled"
            size={14}
            color={BROWN_LIGHT}
          />
          <Typography className={classes.videoFilterText}>Видео</Typography>
        </Action>
      )}
      <div
        className={["ui-stack ", classes.toggleRow].filter(Boolean).join(" ")}
      >
        <Action
          aria-label="Показать лентой"
          aria-pressed={viewMode === "feed"}
          onClick={() => setViewMode("feed")}
          className={[
            classes.toggleButtonActive,
            viewMode === "feed"
              ? classes.backgroundColorState
              : classes.backgroundColorState2,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="view-agenda"
            size={16}
            color={viewMode === "feed" ? CREAM_BG : BROWN_LIGHT}
          />
        </Action>
        <Action
          aria-label="Показать сеткой"
          aria-pressed={viewMode === "grid"}
          onClick={() => setViewMode("grid")}
          className={[
            classes.toggleButtonActive,
            viewMode === "grid"
              ? classes.backgroundColorState3
              : classes.backgroundColorState4,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name="grid-view"
            size={16}
            color={viewMode === "grid" ? CREAM_BG : BROWN_LIGHT}
          />
        </Action>
      </div>
    </div>
  );
  // ── Tag Chips (full-width row) ──
  const renderTagChips = () => (
    <ScrollArea
      horizontal
      hideScrollbar
      contentClassName={classes.chipScrollContent}
      className={classes.chipScroll}
    >
      {TAGS.map((tag) => {
        const isActive = selectedTag === tag.slug;
        return (
          <Action
            key={tag.slug}
            onClick={() => handleTagPress(tag.slug)}
            className={[
              classes.chipActive,
              isActive ? classes.appearanceState : classes.appearanceState2,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography
              className={[
                classes.chipTextActive,
                isActive ? classes.colorState : classes.colorState2,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {tag.label}
            </Typography>
          </Action>
        );
      })}
    </ScrollArea>
  );
  // ── Grid Item ──
  const isVideoPost = (post: FeedPost) =>
    (post.tags || []).includes("video") ||
    (post.media || []).some((item) => item.type === "video") ||
    (post.photos || []).some((url) => /\.(mp4|mov|webm)$/i.test(url));
  const renderGridItem = ({ item }: { item: FeedPost }) => (
    <GridItem
      item={item}
      isVideo={isVideoPost(item)}
      href={
        item.articleId
          ? `/library/article/${item.articleId}`
          : `/post/${item.id}`
      }
    />
  );
  // ── Header ──
  const renderHeader = () => (
    <div className={["ui-stack ", classes.div].filter(Boolean).join(" ")}>
      {renderBanner()}
      <PostInteractionStatus
        error={interactions.error}
        retry={interactions.retry}
      />
      {renderSearchRow()}
      {renderTagChips()}
      {feedQuery.hasPreviousPage && (
        <Action
          disabled={feedQuery.isFetchingPreviousPage}
          onClick={() => void feedQuery.fetchPreviousPage()}
        >
          {feedQuery.isFetchingPreviousPage
            ? "Загрузка…"
            : feedQuery.isFetchPreviousPageError
              ? "Повторить загрузку предыдущих публикаций"
              : "Предыдущие публикации"}
        </Action>
      )}
    </div>
  );
  const handlePostPress = (postId: number) => {
    const post = posts.find((item) => item.id === postId);
    if (post?.articleId) {
      router.push(`/library/article/${post.articleId}`);
      return;
    }
    router.push(`/post/${postId}`);
  };
  // Post management (owner only)
  const { openMenu, ManagementModals } = usePostManagement(onRefresh);
  // ── Feed Item ──
  const renderFeedItem = ({ item }: { item: FeedPost }) => (
    <PostCard
      post={item}
      isLiked={interactions.likedIds.has(item.id)}
      isSaved={interactions.savedIds.has(item.id)}
      likePending={
        Boolean(user) &&
        (!interactions.isReady(item.id) ||
          interactions.isPending("like", item.id))
      }
      savePending={
        Boolean(user) &&
        (!interactions.isReady(item.id) ||
          interactions.isPending("save", item.id))
      }
      onLike={handleLike}
      onSave={handleSave}
      onClick={handlePostPress}
      onPhotoPress={openViewer}
      onMenuPress={
        isOwner
          ? () =>
              openMenu({
                id: item.id,
                text: item.text,
                photos: item.photos,
                tags: item.tags,
                richText: item.richText ?? null,
                publishedAt: item.publishedAt ?? null,
                createdAt: item.createdAt ?? null,
                target: item.target || "feed",
                media: item.media,
              })
          : undefined
      }
    />
  );
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetching && !isError) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetching, isError, fetchNextPage]);
  const renderFooter = () => {
    if (posts.length > 0 && isFetchNextPageError) {
      return (
        <QueryRetryState
          isLoading={isFetchingNextPage}
          isError
          loadingSize="small"
          message="Не удалось загрузить следующие публикации ленты"
          onRetry={() => {
            if (isFetching) return;
            if (isFetchNextPageError) void fetchNextPage();
            else void refetch({ cancelRefetch: false });
          }}
        />
      );
    }
    if (isFetchingNextPage) {
      return <LoadingIndicator size="small" />;
    }
    if (!hasNextPage && posts.length > 0) {
      return (
        <div
          className={["ui-stack ", classes.footerLoader]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography className={classes.footerText}>
            Все посты загружены
          </Typography>
        </div>
      );
    }
    return null;
  };
  const requestPending = (isLoading || isError) && !paginatedData;
  const empty = requestPending ? (
    <QueryRetryState
      isLoading={isLoading}
      loadingContent={<ContentPlaceholder kind="feed" />}
      isError={isError}
      message="Не удалось загрузить ленту"
      onRetry={() => void refetch()}
      className={classes.requestState}
    />
  ) : isError ? null : (
    <Typography className={classes.typography}>Публикаций пока нет</Typography>
  );
  return (
    <ScreenContainer
      style={
        {
          "--floating-stack-height": isOwner
            ? "var(--admin-floating-stack-height)"
            : "44px",
        } as CSSProperties
      }
    >
      {viewMode === "feed" ? (
        <Collection
          windowItems
          retentionKey={feedQuery.identity}
          revealItems
          ref={listRef}
          key="feed"
          data={posts}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id.toString()}
          header={renderHeader()}
          footer={renderFooter()}
          empty={empty}
          hideScrollbar
          onLoadMore={handleLoadMore}
          onLoadPrevious={
            feedQuery.hasPreviousPage && !isError && !isFetching
              ? () => void feedQuery.fetchPreviousPage()
              : undefined
          }
          onVisibleItemsChange={feedQuery.onVisibleItemsChange}
          visiblePercent={0}
          loadMoreThreshold={0.5}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentClassName={
            requestPending ? classes.requestList : classes.listContent
          }
        />
      ) : (
        <Collection
          windowItems
          retentionKey={feedQuery.identity}
          revealItems
          ref={listRef}
          key="grid"
          data={posts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id.toString()}
          columns={GRID_COLUMNS}
          header={renderHeader()}
          footer={renderFooter()}
          empty={empty}
          hideScrollbar
          onLoadMore={handleLoadMore}
          onLoadPrevious={
            feedQuery.hasPreviousPage && !isError && !isFetching
              ? () => void feedQuery.fetchPreviousPage()
              : undefined
          }
          onVisibleItemsChange={feedQuery.onVisibleItemsChange}
          visiblePercent={0}
          loadMoreThreshold={0.5}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentClassName={
            requestPending ? classes.requestList : classes.listContent
          }
          rowClassName={classes.gridRow}
        />
      )}
      {viewerVisible ? (
        <PhotoViewer
          visible={viewerVisible}
          photos={viewerPhotos}
          initialIndex={viewerInitialIndex}
          onClose={closeViewer}
        />
      ) : null}
      {isOwner ? ManagementModals : null}
      <ScrollToTopButton
        key={`scroll-top-${viewMode}`}
        scrollRef={listRef}
        onScrollToTop={
          feedQuery.hasPreviousPage
            ? async () => !(await feedQuery.restart()).isError
            : undefined
        }
      />
      <AdminFAB target="feed" />
    </ScreenContainer>
  );
}
