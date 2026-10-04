"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getVideoScreenLayout } from "./video-screen.layout";
import classes from "./video-screen.module.scss";
import {
  Background,
  Spinner,
  ScrollArea,
  Action,
  Typography,
} from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { createElement } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { useRouter } from "@/shared/navigation/router";
import { useSafeAreaInsets } from "@/shared/ui/safe-area";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { trpc } from "@/shared/api/trpc";
import { parseContentId } from "@/shared/navigation/content-id";
import { ContentRequestState } from "@/shared/ui/content-request-state";
import { YouTubeEmbed } from "@/shared/media/youtube-embed";
import { displayVideoTitle } from "@/shared/media/video-title";
import { PAPER_TEXTURE_URI } from "./video-screen.content";
export default function VideoDetailScreen({ id }: { id: string }) {
  const viewport = useViewport();
  const { stylesLayout } = getVideoScreenLayout(viewport);

  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const handleBack = () => {
    router.back();
  };
  if (isLoading || !video) {
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
              <Spinner size="large" color="#8B7355" />
            ) : (
              <>
                <ContentRequestState
                  error={error}
                  onRetry={() => {
                    void refetch();
                  }}
                  notFoundText="Видео не найдено"
                />
                <Action onClick={handleBack}>
                  <Typography>← Назад</Typography>
                </Action>
              </>
            )}
          </div>
        </Background>
      </ScreenContainer>
    );
  }
  const hasVideoFile = !!video.videoUrl;
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea className={classes.container}>
          {/* Video player area */}
          <div
            style={{
              width: stylesLayout.videoContainer.width,
              height: stylesLayout.videoContainer.height,
            }}
            className={["ui-stack ", classes.videoContainer]
              .filter(Boolean)
              .join(" ")}
          >
            {hasVideoFile ? (
              createElement("video", {
                src: video.videoUrl,
                controls: true,
                playsInline: true,
                preload: "metadata",
                className: classes.videoElement,
              })
            ) : (
              <YouTubeEmbed youtubeId={video.youtubeId} />
            )}
          </div>

          {/* Back button */}
          <Action
            onClick={handleBack}
            style={() => ({
              top: insets.top + 8,
            })}
            className={({ pressed }) =>
              [classes.action, pressed ? classes.opacityState : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </Action>

          {/* Video info */}
          <div
            className={["ui-stack ", classes.infoContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.title}>
              {displayVideoTitle(video.title, video.youtubeId)}
            </Typography>

            {(video.views || video.publishedText) && (
              <Typography className={classes.meta}>
                {video.views}
                {video.publishedText ? ` • ${video.publishedText}` : ""}
              </Typography>
            )}

            <Typography className={classes.qualityHint}>
              В приложении видео доступно к просмотру без VPN, но в более низком
              качестве. Для просмотра в высоком разрешении рекомендую перейти на
              YouTube
            </Typography>

            {video.youtubeId ? (
              <Action
                onClick={() =>
                  void openExternalUrl(
                    `https://www.youtube.com/watch?v=${video.youtubeId}`,
                  )
                }
                className={({ pressed }) =>
                  [classes.action2, pressed ? classes.opacityState2 : ""]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <MaterialIcons
                  name="play-circle-outline"
                  size={20}
                  color="#5C4033"
                />
                <Typography className={classes.youtubeBtnText}>
                  Смотреть на YouTube →
                </Typography>
              </Action>
            ) : null}
          </div>
        </ScrollArea>
      </Background>
    </ScreenContainer>
  );
}
