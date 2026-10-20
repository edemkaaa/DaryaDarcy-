"use client";
import classes from "./youtube-embed.module.scss";
import { useMemo, useEffect, useRef } from "react";
import { ManagedVideo } from "./managed-video";
import { apiUrl } from "@/shared/config/api";
type Props = {
  youtubeId: string;
  catalogMode?: boolean;
  officialPlayer?: boolean;
  onRetry?: () => void;
};
export function YouTubeEmbed({
  youtubeId,
  catalogMode = false,
  officialPlayer = false,
  onRetry,
}: Props) {
  const src = useMemo(
    () => apiUrl(`/api/yt/${encodeURIComponent(youtubeId)}`),
    [youtubeId],
  );
  const poster = useMemo(
    () =>
      apiUrl(`/media/yt-thumb/${encodeURIComponent(youtubeId)}/hqdefault.jpg`),
    [youtubeId],
  );
  if (officialPlayer)
    return <OfficialPlayer key={youtubeId} youtubeId={youtubeId} />;
  return (
    <div className={`ui-stack ${classes.frame}`}>
      <ManagedVideo
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className={classes.videoElement}
        releaseOnPageHide={catalogMode}
        onRetry={onRetry}
      />
    </div>
  );
}

function OfficialPlayer({ youtubeId }: { youtubeId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const src = `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}`;
  useEffect(() => {
    const node = frame.current;
    if (node) node.src = src;
    const hide = () => node?.removeAttribute("src");
    window.addEventListener("pagehide", hide);
    return () => {
      window.removeEventListener("pagehide", hide);
      hide();
    };
  }, [src]);
  return (
    <div className={classes.frame}>
      <iframe
        ref={frame}
        src={src}
        title="YouTube Видео"
        className={classes.videoElement}
        style={{ border: 0 }}
        allow="encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
