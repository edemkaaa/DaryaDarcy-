"use client";
/** Жизненный цикл HTML-video связан с активностью экрана; при уходе воспроизведение останавливаем и освобождаем ресурс при необходимости. */

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { Action } from "@/shared/ui/action";
import classes from "./media-playback.module.scss";

type Props = VideoHTMLAttributes<HTMLVideoElement> & {
  src: string;
  releaseOnPageHide?: boolean;
  onRetry?: () => void;
};
/** Смена src пересоздаёт состояние ошибки и DOM-владельца видео; старый ресурс очищается его эффектом. */
export function ManagedVideo(props: Props) {
  return <VideoResource key={props.src} {...props} />;
}

/** Привязываем остановку и освобождение video к видимости страницы и активности экрана, сохраняя стандартные controls браузера. */
function VideoResource({
  onError,
  onRetry,
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
    /** Ставим на паузу без сброса позиции; освобождение src выполняется отдельным путём. */
    const pause = () => video.pause();
    /** При pagehide всегда останавливаем звук, а опциональный releaseOnPageHide дополнительно отменяет загрузку источника. */
    const hide = () => {
      pause();
      if (releaseOnPageHide) {
        video.removeAttribute("src");
        video.load();
      }
    };
    /** Уход документа в фон останавливает воспроизведение, но не обещает автоматический запуск при возврате. */
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
              // Внешний retry заново проверяет источник; без него повторяем нативную загрузку текущего video.
              if (onRetry) {
                onRetry();
                return;
              }
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
