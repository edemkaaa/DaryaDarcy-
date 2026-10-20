"use client";
import { ManagedVideo } from "@/shared/media/managed-video";

import classes from "./video-screen.module.scss";
import { Background } from "@/shared/ui/elements";

import { ScreenContainer } from "@/shared/ui/screen-container";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { trpc } from "@/shared/api/trpc";
import { parseContentId } from "@/shared/navigation/content-id";
import { ContentRequestState } from "@/shared/ui/content-request-state";
import { YouTubeEmbed } from "@/shared/media/youtube-embed";
import { getVkVideoEmbedUrl } from "@/shared/media/vk-video-url";
import { VkVideoEmbed } from "@/shared/media/vk-video-embed";
import { displayVideoTitle } from "@/shared/media/video-title";
import { PAPER_TEXTURE_URI } from "./video-screen.content";
import { isVkCatalogEnabled } from "./catalog-api";
import { VideoDetailView } from "./video-detail-view";
import { CatalogVideoDetail } from "./catalog-video-detail";
export default function VideoDetailScreen({ id }: { id: string }) {
  return isVkCatalogEnabled() ? (
    <CatalogVideoDetail id={id} />
  ) : (
    <LegacyVideoDetail id={id} />
  );
}
function LegacyVideoDetail({ id }: { id: string }) {
  const videoId = parseContentId(id);
  const {
    data: video,
    isLoading,
    error,
    refetch,
  } = trpc.videos.getById.useQuery(
    { id: videoId ?? 0 },
    { enabled: videoId !== null, staleTime: 30_000 },
  );
  if (isLoading || error || !video) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background}
        >
          <div
            className={["ui-stack ", classes.loadingContainer]
              .filter(Boolean)
              .join(" ")}
          >
            {isLoading ? (
              <ContentPlaceholder kind="video" count={1} />
            ) : (
              <ContentRequestState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                notFoundText="Видео не найдено"
              />
            )}
          </div>
        </Background>
      </ScreenContainer>
    );
  }
  const hasVideoFile = !!video.videoUrl;
  const vkEmbedUrl = video.videoUrl ? getVkVideoEmbedUrl(video.videoUrl) : null;
  const player = vkEmbedUrl ? (
    <VkVideoEmbed url={vkEmbedUrl} className={classes.videoElement} />
  ) : hasVideoFile ? (
    <ManagedVideo
      src={video.videoUrl!}
      controls
      playsInline
      preload="metadata"
      className={classes.videoElement}
    />
  ) : (
    <YouTubeEmbed youtubeId={video.youtubeId} />
  );
  return (
    <VideoDetailView
      title={displayVideoTitle(video.title, video.youtubeId)}
      player={player}
      youtubeId={vkEmbedUrl ? undefined : video.youtubeId}
      meta={
        video.views || video.publishedText
          ? `${video.views ?? ""}${video.publishedText ? ` • ${video.publishedText}` : ""}`
          : undefined
      }
      hint={
        vkEmbedUrl
          ? "Видео воспроизводится плеером VK. Качество и полноэкранный режим можно выбрать в настройках плеера."
          : hasVideoFile
            ? "Качество и полноэкранный режим можно выбрать в настройках плеера."
            : "Если видео не запускается, повторите загрузку. Оригинал можно открыть на YouTube."
      }
    />
  );
}
