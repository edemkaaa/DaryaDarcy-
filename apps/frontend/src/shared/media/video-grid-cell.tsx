"use client";
import classes from "./video-grid-cell.module.scss";
import { Action } from "@/shared/ui/elements";
import { createElement, useState, type SyntheticEvent } from "react";
import { useCollectionItemRetention } from "@/shared/ui/collection-item-window";
import { Picture } from "@/shared/media/image";
import MaterialIcons from "@/shared/ui/material-icon";
import {
  FALLBACK_PHOTO_RATIO,
  usePhotoAspectRatios,
} from "@/shared/media/photo-aspect-ratios";
interface VideoGridCellProps {
  url: string;
  thumbnailUrl?: string;
  onClick?: () => void;
  standalone?: boolean;
  fillCell?: boolean;
}
export function VideoGridCell({
  url,
  thumbnailUrl,
  onClick,
  standalone,
  fillCell = false,
}: VideoGridCellProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  useCollectionItemRetention(isPlaying && !ended);
  const { ratios, onLoad } = usePhotoAspectRatios(
    thumbnailUrl ? [thumbnailUrl] : [],
  );
  const aspectRatio = ratios[0] ?? FALLBACK_PHOTO_RATIO;
  const isPortrait = aspectRatio < 0.95;
  const fitMode = isPortrait ? "contain" : "cover";
  if (isPlaying) {
    return (
      <div
        style={{
          aspectRatio: fillCell ? undefined : aspectRatio,
          height: fillCell ? "100%" : undefined,
          width: fillCell ? "100%" : undefined,
        }}
        className={[
          ["ui-stack ", classes.portraitBg].filter(Boolean).join(" "),
          standalone ? classes.widthState : "",
          standalone ? "" : classes.flexState,
          isPortrait
            ? classes.backgroundColorState
            : classes.backgroundColorState2,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {createElement("video", {
          src: url,
          poster: thumbnailUrl || undefined,
          controls: true,
          playsInline: true,
          preload: "metadata",
          onPlay: () => setEnded(false),
          onSeeked: (event: SyntheticEvent<HTMLVideoElement>) =>
            setEnded(event.currentTarget.ended),
          onEnded: () => setEnded(true),
          style: {
            backgroundColor: isPortrait ? "#EDE6DA" : "#1a1a1a",
            objectFit: fitMode,
          },
          className: classes.videoElement,
        })}
      </div>
    );
  }
  const handlePress = () => {
    if (onClick) {
      onClick();
      return;
    }
    setIsPlaying(true);
  };
  return (
    <Action
      aria-label="Открыть видео"
      onClick={handlePress}
      style={() => ({
        aspectRatio: fillCell ? undefined : aspectRatio,
        height: fillCell ? "100%" : undefined,
        width: fillCell ? "100%" : undefined,
      })}
      className={({ pressed }) =>
        [
          classes.portraitBg,
          standalone ? classes.widthState2 : "",
          pressed ? classes.opacityState : "",
          standalone ? "" : classes.flexState2,
          isPortrait
            ? classes.backgroundColorState3
            : classes.backgroundColorState4,
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      {thumbnailUrl ? (
        <Picture
          source={{ uri: thumbnailUrl }}
          onLoad={onLoad(thumbnailUrl)}
          contentFit="cover"
          className={classes.picture}
        />
      ) : (
        <div
          className={["ui-stack ", classes.placeholder]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="videocam" size={28} color="#B8A99A" />
        </div>
      )}
      <div className={["ui-stack ", classes.overlay].filter(Boolean).join(" ")}>
        <div
          className={["ui-stack ", classes.playCircle]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="play-arrow" size={24} color="#FFF" />
        </div>
      </div>
    </Action>
  );
}
