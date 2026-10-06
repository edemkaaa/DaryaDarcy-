"use client";
import classes from "./video-grid-cell.module.scss";
import { Action } from "@/shared/ui/elements";
import { createElement, useState } from "react";
import { Picture } from "@/shared/media/image";
import MaterialIcons from "@/shared/ui/material-icon";
import {
  FALLBACK_PHOTO_RATIO,
  useMediaAspectRatio,
} from "@/shared/media/photo-aspect-ratios";
interface VideoGridCellProps {
  url: string;
  thumbnailUrl?: string;
  onClick?: () => void;
  standalone?: boolean;
}
export function VideoGridCell({
  url,
  thumbnailUrl,
  onClick,
  standalone,
}: VideoGridCellProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const aspectRatio = useMediaAspectRatio(thumbnailUrl, FALLBACK_PHOTO_RATIO);
  const isPortrait = aspectRatio < 0.95;
  const fitMode = isPortrait ? "contain" : "cover";
  if (isPlaying) {
    return (
      <div
        style={{
          aspectRatio: aspectRatio,
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
        aspectRatio: aspectRatio,
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
