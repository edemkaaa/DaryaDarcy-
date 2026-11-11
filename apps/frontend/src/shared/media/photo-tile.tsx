"use client";
/** Плитка фотографии получает готовую геометрию и передаёт открытие владельцу списка. */

import { useState, type CSSProperties } from "react";
import { Action } from "@/shared/ui/elements";
import { ImageFailure, Picture, type ImageProps } from "./image";
import classes from "./photo-tile.module.scss";

type PhotoTileProps = {
  uri?: string;
  onPhotoPress?: () => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
  onLoad?: ImageProps["onLoad"];
  sizes?: string;
};

/** Смена URI сбрасывает локальное состояние отказа и повтора через новый экземпляр карточки. Кнопка повтора остаётся рядом с действием фото, без вложенных кнопок. */
export function PhotoTile(props: PhotoTileProps) {
  return <PhotoTileContent key={props.uri} {...props} />;
}

/** Держим кнопку открытия и кнопку повтора соседями, чтобы не создавать вложенные интерактивные элементы. */
function PhotoTileContent({
  uri,
  onPhotoPress,
  label = "Открыть фото",
  className,
  style,
  onLoad,
  sizes,
}: PhotoTileProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  return (
    <div className={`ui-stack ${className ?? ""}`} style={style}>
      <Action
        aria-label={label}
        disabled={!onPhotoPress}
        onClick={onPhotoPress}
        className={({ pressed }) =>
          `${classes.open} ${pressed ? classes.pressed : ""}`
        }
      >
        <Picture
          source={uri}
          sizes={sizes}
          retryKey={retryKey}
          contentFit="cover"
          transition={180}
          fadeOnLoad
          errorFallback={null}
          className={classes.picture}
          onError={() => setFailedUri(uri ?? null)}
          onLoad={(event) => {
            setFailedUri(null);
            onLoad?.(event);
          }}
        />
      </Action>
      {uri && failedUri === uri ? (
        <ImageFailure
          onRetry={() => {
            setFailedUri(null);
            setRetryKey((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}
