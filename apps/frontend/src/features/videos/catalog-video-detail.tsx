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
import { Action, Background, Typography } from "@/shared/ui/elements";
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
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
              <QueryRetryState
                isLoading={false}
                isError
                message="Не удалось проверить сессию"
                onRetry={() => void auth.refresh()}
              />
            ) : pending ? (
              <ContentPlaceholder kind="video" count={1} />
            ) : status === 401 ? (
              <>
                <Typography>Войдите, чтобы смотреть это видео</Typography>
                <Action onClick={() => router.login(`/video/${id}`)}>
                  <Typography>Войти</Typography>
                </Action>
              </>
            ) : status === 403 ? (
              <>
                <Typography>Для просмотра нужен доступ к клубу</Typography>
                <Action onClick={() => router.push("/club")}>
                  <Typography>Перейти в клуб</Typography>
                </Action>
              </>
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
        url={source.embedUrl}
        className={classes.videoElement}
        recheckOnResume
      />
    ) : source.videoUrl ? (
      <ManagedVideo
        src={source.videoUrl}
        controls
        playsInline
        preload="metadata"
        className={classes.videoElement}
        releaseOnPageHide
      />
    ) : (
      <YouTubeEmbed
        youtubeId={source.youtubeId}
        catalogMode
        officialPlayer={!publicYouTube}
      />
    );
  return (
    <VideoDetailView
      title={displayVideoTitle(metadata.data?.title ?? "Видео", youtube)}
      player={player}
      youtubeId={youtube}
      hint={
        source.provider === "vk"
          ? "Видео воспроизводится плеером VK. Качество и полноэкранный режим можно выбрать в настройках плеера."
          : publicYouTube && !source.videoUrl
            ? "В приложении видео доступно к просмотру без VPN, но в более низком качестве. Для просмотра в высоком разрешении рекомендую перейти на YouTube"
            : "Качество и полноэкранный режим можно выбрать в настройках плеера."
      }
    />
  );
}
