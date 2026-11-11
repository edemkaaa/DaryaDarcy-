"use client";
/** Старый и новый каталоги выбираются по настройке сборки; чтение списка не используется как разрешение воспроизвести закрытый ролик. */
import { useViewport } from "@/shared/browser/viewport";

import { getVideosScreenLayout } from "./videos-screen.layout";
import classes from "./videos-screen.module.scss";
import {
  Typography,
  Action,
  Background,
  Collection,
} from "@/shared/ui/elements";
import { useCallback, useState } from "react";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { MaterialIcons } from "@/shared/ui/icons";
import { displayVideoTitle } from "@/shared/media/video-title";
import { ScreenContainer } from "@/shared/ui/screen-container";

import { VideosBannerHeader } from "./videos-banner";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { trpc } from "@/shared/api/trpc";
import type { ApiOutputs } from "@/shared/api/types";
import { contentRefreshOptions } from "@/shared/api/content-refresh";
import { PAPER_TEXTURE_URI } from "./videos-screen.content";
import { apiUrl } from "@/shared/config/api";
import { isVkCatalogEnabled } from "./catalog-api";
import { VideoCatalogScreen } from "./catalog-screen";
type Video = ApiOutputs["videos"]["list"][number];
/** Старый список продолжает читать прежний контракт до включения каталога VK; локальный refresh не меняет playback-права. */
function VideosScreenInner() {
  const active = useScreenActive();
  const viewport = useViewport();
  const { stylesLayout } = getVideosScreenLayout(viewport);

  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: videos,
    isLoading,
    isError,
    refetch,
  } = trpc.videos.list.useQuery(undefined, {
    staleTime: 30_000,
    ...contentRefreshOptions(active),
  });
  /** Отдельно показываем pull-to-refresh пока перечитывается список, не пересоздавая шапку и карточки заранее. */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  useBackgroundNotice({
    when: isError && videos !== undefined,
    message: "Не удалось обновить видео",
    onRetry: () => refetch({ cancelRefetch: false }),
  });
  const handleVideoPress = useCallback(
    /** Открываем стабильный внутренний маршрут детали, не передавая URL плеера через навигацию. */
    (video: Video) => {
      router.push(`/video/${video.id}`);
    },
    [router],
  );
  const renderVideoCard = useCallback(
    /** Сохранённая не-YouTube обложка имеет приоритет; прежние YouTube-превью направляем через серверный thumbnail-путь. */
    ({ item }: { item: Video }) => {
      const stored = item.thumbnailUrl?.trim() ?? "";
      const thumbnailUrl =
        stored &&
        !/ytimg\.com|img\.youtube\.com|\/media\/yt-thumb\//i.test(stored)
          ? stored
          : apiUrl(
              `/media/yt-thumb/${encodeURIComponent(item.youtubeId)}/hqdefault.jpg`,
            );
      return (
        <Action
          onClick={() => handleVideoPress(item)}
          className={({ pressed }) =>
            [classes.action, pressed ? classes.opacityState : ""]
              .filter(Boolean)
              .join(" ")
          }
        >
          <div
            style={{ height: stylesLayout.thumbnailContainer.height }}
            className={["ui-stack ", classes.thumbnailContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Picture
              source={{ uri: thumbnailUrl }}
              contentFit="cover"
              transition={200}
              className={classes.thumbnail}
            />
            {item.duration ? (
              <div
                className={["ui-stack ", classes.durationBadge]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.durationText}>
                  {item.duration}
                </Typography>
              </div>
            ) : null}
            <div
              className={["ui-stack ", classes.playOverlay]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="play-arrow"
                size={48}
                color="rgba(255,255,255,0.9)"
              />
            </div>
          </div>
          <div
            className={["ui-stack ", classes.cardDescriptionContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography lines={2} className={classes.title}>
              {displayVideoTitle(item.title, item.youtubeId)}
            </Typography>
            <Typography className={classes.meta}>Смотреть</Typography>
            {item.views ? (
              <Typography className={classes.meta}>
                {item.views}
                {item.publishedText ? ` • ${item.publishedText}` : ""}
              </Typography>
            ) : null}
          </div>
        </Action>
      );
    },
    [handleVideoPress, stylesLayout.thumbnailContainer.height],
  );
  return (
    <ScreenContainer>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <Collection
          revealItems
          data={videos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderVideoCard}
          header={<VideosBannerHeader />}
          empty={
            <QueryRetryState
              isLoading={isLoading}
              loadingContent={<ContentPlaceholder kind="video" />}
              isError={isError && videos === undefined}
              onRetry={() => void refetch()}
              message="Не удалось загрузить видео"
              className={classes.loadingContainer}
            />
          }
          contentStyle={{
            paddingBottom: videos?.length ? "var(--page-end-gap)" : 0,
          }}
          hideScrollbar
          refreshing={refreshing}
          onRefresh={onRefresh}
          divider={() => (
            <div
              className={["ui-stack ", classes.separator]
                .filter(Boolean)
                .join(" ")}
            />
          )}
          contentClassName={classes.collectioncontent}
        />
      </Background>
    </ScreenContainer>
  );
}
/** Выбираем старый или новый протокол каталога единственным build-флагом. */
export default function VideosScreen() {
  if (isVkCatalogEnabled()) return <VideoCatalogScreen />;
  return (
    <div className="ui-stack ">
      <VideosScreenInner />
    </div>
  );
}
