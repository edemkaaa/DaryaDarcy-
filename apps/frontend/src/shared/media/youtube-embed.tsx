"use client";
import classes from "./youtube-embed.module.scss";
import { createElement, useMemo } from "react";
import { apiUrl } from "@/shared/config/api";
type Props = {
  youtubeId: string;
};
export function YouTubeEmbed({ youtubeId }: Props) {
  const src = useMemo(
    () => apiUrl(`/api/yt/${encodeURIComponent(youtubeId)}`),
    [youtubeId],
  );
  const poster = useMemo(
    () =>
      apiUrl(`/media/yt-thumb/${encodeURIComponent(youtubeId)}/hqdefault.jpg`),
    [youtubeId],
  );
  {
    return (
      <div className={["ui-stack ", classes.frame].filter(Boolean).join(" ")}>
        {createElement("video", {
          src,
          poster,
          controls: true,
          playsInline: true,
          preload: "metadata",
          className: classes.videoElement,
        })}
      </div>
    );
  }
}
