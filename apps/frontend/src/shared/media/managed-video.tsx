"use client";

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { Action } from "@/shared/ui/action";
import classes from "./media-playback.module.scss";

type Props = VideoHTMLAttributes<HTMLVideoElement> & {
  src: string;
  releaseOnPageHide?: boolean;
};
export function ManagedVideo(props: Props) {
  return <VideoResource key={props.src} {...props} />;
}

function VideoResource({
  onError,
  releaseOnPageHide = false,
  ...props
}: Props) {
  const node = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const active = useScreenActive();
  useEffect(() => {
    const video = node.current;
    if (!video) return;
    // Restore after React Strict Mode's setup/cleanup/setup cycle as well.
    if (video.getAttribute("src") !== props.src) video.src = props.src;
    const pause = () => video.pause();
    const hide = () => {
      pause();
      if (releaseOnPageHide) {
        video.removeAttribute("src");
        video.load();
      }
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [props.src, releaseOnPageHide]);
  useEffect(() => {
    if (!active) node.current?.pause();
  }, [active]);
  return (
    <div className={classes.frame}>
      <video
        {...props}
        ref={node}
        onError={(event) => {
          setFailed(true);
          onError?.(event);
        }}
      />
      {failed && (
        <div className={classes.notice} role="alert">
          <span>
            Не удалось воспроизвести видео. Проверьте соединение или формат
            файла.
          </span>
          <Action
            className={classes.retry}
            onClick={() => {
              setFailed(false);
              node.current?.load();
            }}
          >
            Повторить загрузку видео
          </Action>
        </div>
      )}
    </div>
  );
}
