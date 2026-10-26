"use client";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";
import { trpc } from "@/shared/api/trpc";
import { getHttpStatus } from "@/shared/api/errors";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { parseContentId } from "@/shared/navigation/content-id";
import { useRouter } from "@/shared/navigation/router";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { Background, Typography } from "@/shared/ui/elements";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { ContentRequestState } from "@/shared/ui/content-request-state";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { VkVideoEmbed } from "@/shared/media/vk-video-embed";
import { ManagedVideo } from "@/shared/media/managed-video";
import { YouTubeEmbed } from "@/shared/media/youtube-embed";
import { displayVideoTitle } from "@/shared/media/video-title";
import { parseVideoCatalog, parseVideoPlayback } from "./catalog-api";
import { PlaybackLifecycle } from "./playback-lifecycle";
import { VideoDetailView } from "./video-detail-view";
import { PAPER_TEXTURE_URI } from "./video-screen.content";
import classes from "./video-screen.module.scss";

export function CatalogVideoDetail({ id }: { id: string }) {
  const videoId = parseContentId(id);
  const auth = useAuth();
  const active = useScreenActive();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [lifecycle] = useState(() => new PlaybackLifecycle());
  const { visible, epoch } = useSyncExternalStore(
    lifecycle.subscribe,
    lifecycle.getSnapshot,
    lifecycle.getServerSnapshot,
  );
  const ready =
    active &&
    visible &&
    !auth.loading &&
    !auth.error &&
    !auth.refreshError &&
    videoId !== null;
  const owner = auth.user?.id ?? "guest";
  const playback = useQuery({
    queryKey: ["video-playback", videoId, owner, epoch],
    enabled: ready,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    // PlaybackLifecycle refreshes both authority and metadata for each return.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) =>
      parseVideoPlayback(
        await utils.client.videos.playback.query({ id: videoId! }, { signal }),
        videoId!,
      ),
  });
  // Catalog order is ascending by ID. A one-card page provides metadata on direct navigation.
  // Metadata never grants access or supplies a source.
  const metadata = useQuery({
    queryKey: ["video-card", videoId, owner, epoch],
    enabled: ready,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const page = parseVideoCatalog(
        await utils.client.videos.catalog.query(
          { limit: 1, ...(videoId! > 1 ? { cursor: videoId! - 1 } : {}) },
          { signal },
        ),
      );
      return page.items.find((item) => item.id === videoId) ?? null;
    },
  });
  if (auth.loading || auth.error) return <SessionStatus />;
  const waitingForMetadata =
    playback.data?.provider === "youtube" &&
    !playback.data.videoUrl &&
    metadata.isPending;
  const source =
    ready && !playback.isFetching && !playback.isError && !waitingForMetadata
      ? playback.data
      : undefined;
  if (!source) {
    const status = getHttpStatus(playback.error);
    const pending = videoId !== null && !playback.isError && !auth.refreshError;
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background}
        >
          <div className={`ui-stack ${classes.loadingContainer}`}>
            {auth.refreshError ? (
              <Typography className={classes.accessCheck}>
                Воспроизведение приостановлено до проверки доступа.
              </Typography>
            ) : pending ? (
              <ContentPlaceholder kind="video" count={1} />
            ) : status === 401 ? (
              <StatusNotice
                actions={
                  <StatusNoticeAction
                    onClick={() => router.login(`/video/${id}`)}
                  >
                    Войти
                  </StatusNoticeAction>
                }
              >
                Войдите, чтобы смотреть это видео
              </StatusNotice>
            ) : status === 403 ? (
              <StatusNotice
                actions={
                  <StatusNoticeAction onClick={() => router.push("/club")}>
                    Перейти в клуб
                  </StatusNoticeAction>
                }
              >
                Для просмотра нужен доступ к клубу
              </StatusNotice>
            ) : status === 412 ? (
              <QueryRetryState
                isLoading={false}
                isError
                message="Каталог видео пока недоступен"
                onRetry={() => void playback.refetch()}
              />
            ) : (
              <ContentRequestState
                error={playback.error}
                notFoundText="Видео не найдено"
                onRetry={() => void playback.refetch()}
              />
            )}
          </div>
        </Background>
      </ScreenContainer>
    );
  }
  const youtube = source.provider === "youtube" ? source.youtubeId : undefined;
  const publicYouTube =
    !metadata.isFetching &&
    !metadata.isError &&
    metadata.data?.access === "public";
  const player =
    source.provider === "vk" ? (
      <VkVideoEmbed
        key={playback.dataUpdatedAt}
        url={source.embedUrl}
        className={classes.videoElement}
        recheckOnResume
        onRetry={() => void playback.refetch({ cancelRefetch: false })}
      />
    ) : source.videoUrl ? (
      <ManagedVideo
        key={playback.dataUpdatedAt}
        src={source.videoUrl}
        controls
        playsInline
        preload="metadata"
        className={classes.videoElement}
        releaseOnPageHide
        onRetry={() => void playback.refetch({ cancelRefetch: false })}
      />
    ) : (
      <YouTubeEmbed
        key={playback.dataUpdatedAt}
        youtubeId={source.youtubeId}
        catalogMode
        officialPlayer={!publicYouTube}
        onRetry={() => void playback.refetch({ cancelRefetch: false })}
      />
    );
  return (
    <VideoDetailView
      title={displayVideoTitle(metadata.data?.title ?? "Видео", youtube)}
      player={player}
      youtubeId={publicYouTube ? youtube : undefined}
      hint={
        source.provider === "vk"
          ? "Видео воспроизводится плеером VK. Качество и полноэкранный режим можно выбрать в настройках плеера."
          : publicYouTube && !source.videoUrl
            ? "Если видео не запускается, повторите загрузку. Оригинал можно открыть на YouTube."
            : "Качество и полноэкранный режим можно выбрать в настройках плеера."
      }
    />
  );
}
