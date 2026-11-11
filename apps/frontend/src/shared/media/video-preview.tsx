"use client";
/** Карточка до запуска показывает постер, а проигрыватель создаётся после действия пользователя. */
import { ManagedVideo } from "@/shared/media/managed-video";
import { useViewport } from "@/shared/browser/viewport";

import classes from "./video-preview.module.scss";
import { DomImage } from "@/shared/ui/elements";

import { useEffect, useState } from "react";
import { getVkVideoEmbedUrl } from "./vk-video-url";
import { VkVideoEmbed } from "./vk-video-embed";

interface VideoPreviewProps {
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  duration?: number;
  topAligned?: boolean;
}
export function VideoPreviewCard({
  url,
  thumbnailUrl,
  topAligned,
}: VideoPreviewProps) {
  const viewport = useViewport();

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = viewport;
  const FRAME_WIDTH = SCREEN_WIDTH - 32;
  const LANDSCAPE_HEIGHT = FRAME_WIDTH * (9 / 16);
  const [isPortrait, setIsPortrait] = useState(false);
  const isReel = /\/reels\//i.test(url);
  useEffect(() => {
    setIsPortrait(false);
    if (!thumbnailUrl) return;
    return DomImage.getSize(
      thumbnailUrl,
      (width, height) => {
        if (width && height) setIsPortrait(height > width * 1.05);
      },
      () => {},
    );
  }, [thumbnailUrl]);
  const frameHeight =
    isReel || isPortrait
      ? Math.min(FRAME_WIDTH * (16 / 9), SCREEN_HEIGHT * 0.62)
      : LANDSCAPE_HEIGHT;
  const fitMode = isPortrait ? "contain" : "cover";
  {
    return (
      <div
        style={{
          height: frameHeight,
        }}
        className={[
          ["ui-stack ", classes.portraitFrame].filter(Boolean).join(" "),
          topAligned ? classes.borderTopLeftRadiusState : "",
          topAligned ? classes.borderTopRightRadiusState : "",
          topAligned ? classes.borderBottomLeftRadiusState : "",
          topAligned ? classes.borderBottomRightRadiusState : "",
          topAligned ? classes.marginTopState : classes.marginTopState2,
          isPortrait
            ? classes.backgroundColorState
            : classes.backgroundColorState2,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {getVkVideoEmbedUrl(url) ? (
          <VkVideoEmbed url={url} className={classes.videoElement} />
        ) : (
          <ManagedVideo
            {...{
              src: url,
              poster: thumbnailUrl || undefined,
              controls: true,
              playsInline: true,
              preload: "metadata",
              style: {
                backgroundColor: isPortrait ? "#EDE6DA" : "#1a1a1a",
                objectFit: fitMode,
              },
              className: classes.videoElement,
            }}
          />
        )}
      </div>
    );
  }
}
