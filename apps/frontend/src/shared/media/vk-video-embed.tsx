"use client";
/** VK-iframe живёт только на активном видимом экране; повтор и возврат учитывают необходимость новой проверки воспроизведения. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { Action } from "@/shared/ui/action";
import { getVkVideoEmbedUrl } from "./vk-video-url";
import classes from "./media-playback.module.scss";

/** Подписываем внешний store видимости на события документа и bfcache; cleanup снимает ровно эти listeners. */
const subscribe = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  window.addEventListener("pagehide", notify);
  window.addEventListener("pageshow", notify);
  return () => {
    document.removeEventListener("visibilitychange", notify);
    window.removeEventListener("pagehide", notify);
    window.removeEventListener("pageshow", notify);
  };
};

/** Создаём iframe только для проверенного VK URL на активном видимом экране; удаление плеера останавливает скрытый звук. */
export function VkVideoEmbed({
  url,
  className,
  recheckOnResume = false,
  onRetry,
}: {
  url: string;
  className: string;
  recheckOnResume?: boolean;
  onRetry?: () => void;
}) {
  const src = getVkVideoEmbedUrl(url);
  const active = useScreenActive();
  const visible = useSyncExternalStore(
    subscribe,
    () => !document.hidden,
    () => true,
  );
  // Скрытый iframe может продолжать звук; удаляем сам плеер, а не только скрываем его CSS-стилем.
  if (!src || !active || !visible) return null;
  return (
    <Player
      key={src}
      src={src}
      className={className}
      recheckOnResume={recheckOnResume}
      onRetry={onRetry}
    />
  );
}

/** Управляем одним адресом iframe и ручным повтором; onLoad подтверждает загрузку документа, а не успешный старт видео внутри VK. */
function Player({
  src,
  className,
  recheckOnResume,
  onRetry,
}: {
  src: string;
  className: string;
  recheckOnResume: boolean;
  onRetry?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    // pagehide can precede visibilitychange when entering the back/forward cache.
    /** На pagehide сразу снимаем src до возможного visibilitychange, чтобы bfcache не сохранил звучащий iframe. */
    const hide = () => frame.current?.removeAttribute("src");
    /** Прямое восстановление src допускается только без recheckOnResume; иначе новую проверку выполняет владелец. */
    const show = () => {
      if (!recheckOnResume && frame.current) frame.current.src = src;
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [src, recheckOnResume]);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(timer);
  }, [attempt]);
  return (
    <div className={classes.frame}>
      <iframe
        ref={frame}
        key={attempt}
        src={src}
        title="VK Видео"
        className={className}
        style={{ border: 0 }}
        allow="encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
      />
      {!loaded && slow && (
        <div className={classes.notice} role="status">
          Плеер VK загружается дольше обычного. Проверьте соединение и повторите
          загрузку.
          <Action
            className={classes.retry}
            aria-label="Перезагрузить плеер VK"
            onClick={() => {
              // Владелец может сначала обновить защищённый источник; локальный повтор пересоздаёт только iframe.
              if (onRetry) {
                onRetry();
                return;
              }
              setLoaded(false);
              setSlow(false);
              setAttempt((value) => value + 1);
            }}
          >
            Повторить загрузку
          </Action>
        </div>
      )}
    </div>
  );
}
