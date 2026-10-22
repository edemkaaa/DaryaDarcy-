"use client";
import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { trpc } from "@/shared/api/trpc";
import { contentRefreshOptions } from "@/shared/api/content-refresh";
import { useAuth } from "@/domain/session/session-context";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { useRouter } from "@/shared/navigation/router";
import { useViewport } from "@/shared/browser/viewport";
import {
  Background,
  Collection,
  Action,
  Typography,
} from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { SessionStatus } from "@/domain/session/session-status";
import { displayVideoTitle } from "@/shared/media/video-title";
import { Picture } from "@/shared/media/image";
import {
  parseVideoCatalog,
  nextVideoCursor,
  stalledVideoCursor,
  videoThumbnailUrl,
  videoCatalogInput,
  type VideoCard,
} from "./catalog-api";
import { getVideosScreenLayout } from "./videos-screen.layout";
import { VideosBannerHeader } from "./videos-banner";
import { PAPER_TEXTURE_URI } from "./videos-screen.content";
import classes from "./videos-screen.module.scss";

export function VideoCatalogScreen() {
  const active = useScreenActive();
  const { loading, error: sessionError } = useAuth();
  const { stylesLayout } = getVideosScreenLayout(useViewport());
  const router = useRouter();
  const utils = trpc.useUtils();
  const catalogInput = videoCatalogInput(20);
  const query = useInfiniteQuery({
    queryKey: getQueryKey(trpc.videos.catalog, catalogInput, "infinite"),
    initialPageParam: undefined as number | undefined,
    // The same opt-in is included in the cache key and every requested page.
    queryFn: ({ pageParam, signal }) =>
      utils.client.videos.catalog.query(videoCatalogInput(20, pageParam), {
        signal,
      }),
    ...contentRefreshOptions(active && !loading && !sessionError),
    staleTime: 0,
    refetchOnMount: "always",
    getNextPageParam: (last, _pages, _lastParam, params) => {
      try {
        return nextVideoCursor(parseVideoCatalog(last), params);
      } catch {
        return undefined;
      } // select reports an invalid response without breaking the screen.
    },
    select: (data) => ({ ...data, pages: data.pages.map(parseVideoCatalog) }),
  });
  const stalled = stalledVideoCursor(
    query.data?.pages.at(-1),
    query.data?.pageParams ?? [],
  );
  useBackgroundNotice({
    when: query.isRefetchError && query.data !== undefined,
    message: "Не удалось обновить видео",
    onRetry: () => query.refetch({ cancelRefetch: false }),
  });
  const rows = useMemo(
    () => [
      ...new Map(
        (query.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [
          item.id,
          item,
        ]),
      ).values(),
    ],
    [query.data],
  );
  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetching && !query.isError && !stalled)
      void query.fetchNextPage({ cancelRefetch: false });
  }, [query, stalled]);
  const retry = () => {
    if (query.isFetching) return;
    if (query.isFetchNextPageError)
      void query.fetchNextPage({ cancelRefetch: false });
    else void query.refetch({ cancelRefetch: false });
  };
  if (loading || sessionError) return <SessionStatus />;
  const renderCard = ({ item }: { item: VideoCard }) => {
    const thumbnail = videoThumbnailUrl(item.thumbnailUrl);
    return (
      <Action
        aria-label={`Открыть видео: ${displayVideoTitle(item.title)}`}
        onClick={() => router.push(`/video/${item.id}`)}
        className={({ pressed }) =>
          [classes.action, pressed ? classes.opacityState : ""]
            .filter(Boolean)
            .join(" ")
        }
      >
        <div
          data-video-thumbnail
          className={classes.thumbnailContainer}
          style={{
            height: stylesLayout.thumbnailContainer.height,
            background: "var(--brown)",
          }}
        >
          {thumbnail ? (
            <Picture
              source={{ uri: thumbnail }}
              contentFit="cover"
              className={classes.thumbnail}
              loadingFallback={null}
              errorFallback={<ThumbnailUnavailable />}
            />
          ) : (
            <ThumbnailUnavailable />
          )}
          <div className={`ui-stack ${classes.playOverlay}`}>
            <MaterialIcons
              name={item.canWatch ? "play-arrow" : "lock-outline"}
              size={48}
              color="rgba(255,255,255,0.9)"
            />
          </div>
          {item.duration ? (
            <div className={`ui-stack ${classes.durationBadge}`}>
              <Typography className={classes.durationText}>
                {item.duration}
              </Typography>
            </div>
          ) : null}
        </div>
        <div className={`ui-stack ${classes.cardDescriptionContainer}`}>
          <Typography lines={2} className={classes.title}>
            {displayVideoTitle(item.title)}
          </Typography>
          <Typography className={classes.meta}>
            {item.access === "club" ? "Для участниц клуба" : "Смотреть"}
          </Typography>
        </div>
      </Action>
    );
  };
  return (
    <ScreenContainer>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <Collection
          revealItems
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          header={<VideosBannerHeader />}
          empty={
            <QueryRetryState
              isLoading={query.isPending}
              loadingContent={<ContentPlaceholder kind="video" />}
              isError={query.isError && query.data === undefined}
              onRetry={retry}
              message="Не удалось загрузить видео"
              className={classes.loadingContainer}
            />
          }
          footer={
            rows.length ? (
              <>
                <QueryRetryState
                  isLoading={query.isFetchingNextPage}
                  loadingSize="small"
                  isError={query.isFetchNextPageError || stalled}
                  onRetry={retry}
                  message="Не удалось загрузить следующие видео"
                />
                {query.hasNextPage && !query.isError && !stalled ? (
                  <Action
                    onClick={loadMore}
                    disabled={query.isFetching}
                    className={`${classes.action} ${classes.loadMore}`}
                  >
                    <Typography className={classes.meta}>
                      Показать ещё
                    </Typography>
                  </Action>
                ) : null}
              </>
            ) : null
          }
          contentStyle={{
            paddingBottom: rows.length ? "var(--page-end-gap)" : 0,
          }}
          hideScrollbar
          onRefresh={async () => {
            await query.refetch({ cancelRefetch: false });
          }}
          divider={() => <div className={classes.separator} />}
          contentClassName={classes.collectioncontent}
        />
      </Background>
    </ScreenContainer>
  );
}

function ThumbnailUnavailable() {
  return (
    <Typography className={classes.thumbnailUnavailable}>
      Обложка недоступна
    </Typography>
  );
}
