"use client";
/** Карточки нового каталога показывают отдельное состояние обложки и передают запуск странице воспроизведения. */
import { CursorPagePrevious } from "@/shared/ui/cursor-page-previous";
import { useMemo } from "react";
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
import { videoThumbnailUrl, type VideoCard } from "./catalog-api";
import { useVideoCatalog } from "./use-video-catalog";
import { getVideosScreenLayout } from "./videos-screen.layout";
import { VideosBannerHeader } from "./videos-banner";
import { PAPER_TEXTURE_URI } from "./videos-screen.content";
import classes from "./videos-screen.module.scss";

/** Смена аккаунта пересоздаёт локальное окно каталога через owner-key. */
export function VideoCatalogScreen() {
  const { user } = useAuth();
  const owner = String(user?.id ?? "guest");
  return <Catalog key={owner} owner={owner} />;
}

/** Сохраняем серверный порядок страниц и показываем фоновые ошибки отдельно от подтверждённых карточек. */
function Catalog({ owner }: { owner: string }) {
  const active = useScreenActive();
  const { loading, error: sessionError } = useAuth();
  const { stylesLayout } = getVideosScreenLayout(useViewport());
  const router = useRouter();
  const query = useVideoCatalog(active && !loading && !sessionError, owner);
  const { stalled } = query;
  useBackgroundNotice({
    when: query.isRefetchError && query.pages.length > 0,
    message: "Не удалось обновить видео",
    onRetry: query.refresh,
  });
  const rows = useMemo(
    () => [
      ...new Map(
        query.pages
          .flatMap((page) => page.items)
          .map((item) => [item.id, item]),
      ).values(),
    ],
    [query.pages],
  );
  const loadMore = query.fetchNextPage;
  const retry = query.retry;
  if (loading || sessionError) return <SessionStatus />;
  /** Рисуем публичный thumbnail и признак canWatch; переход к playback заново проверит права на сервере. */
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
          preserveScroll
          revealItems
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          header={
            <>
              <VideosBannerHeader />
              <CursorPagePrevious query={query} label="Предыдущие видео" />
            </>
          }
          empty={
            <QueryRetryState
              isLoading={query.isPending}
              loadingContent={<ContentPlaceholder kind="video" />}
              isError={query.isError && query.pages.length === 0}
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
          onRefresh={query.refresh}
          onVisibleItemsChange={query.onVisibleItemsChange}
          visiblePercent={1}
          divider={() => <div className={classes.separator} />}
          contentClassName={classes.collectioncontent}
        />
      </Background>
    </ScreenContainer>
  );
}

/** Явно показываем отсутствие обложки без подмены источника самого видео. */
function ThumbnailUnavailable() {
  return (
    <Typography className={classes.thumbnailUnavailable}>
      Обложка недоступна
    </Typography>
  );
}
