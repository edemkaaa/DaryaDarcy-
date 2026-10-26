"use client";

import { useRef, useState, type CSSProperties } from "react";
import {
  Action,
  MeasuredBox,
  ScrollArea,
  Typography,
} from "@/shared/ui/elements";
import { ImageFailure, Picture, type ImageProps } from "@/shared/media/image";
import { postPhotoRows } from "@/shared/media/post-photo-rows";
import {
  usePhotoAspectRatios,
  FALLBACK_PHOTO_RATIO,
} from "@/shared/media/photo-aspect-ratios";
import { VideoGridCell } from "@/shared/media/video-grid-cell";
import {
  PostVideoCarousel,
  type PostVideoSlide,
} from "@/shared/media/post-video-carousel";
import { usePhotoMouseDrag } from "@/shared/media/use-photo-mouse-drag";
import { scrollPhotoWithKeyboard } from "@/shared/media/photo-carousel-navigation";
import { useCollectionItemRetention } from "@/shared/ui/collection-item-window";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import classes from "./club-post-photos.module.scss";

// Club-only trial of the original Expo layout. Learn dimensions from the actual
// displayed Picture, preserving bounded loading and protected delivery.
function ClubPhoto({
  uri,
  index,
  onPhotoPress,
  single = false,
  width,
  contain = false,
  preload = true,
  onImageLoad,
}: {
  uri: string;
  index: number;
  onPhotoPress?: (index: number) => void;
  single?: boolean;
  width?: number;
  contain?: boolean;
  preload?: boolean;
  onImageLoad?: ImageProps["onLoad"];
}) {
  const nearby = useCollectionItemRetention(false);
  const active = useScreenActive();
  const { ratios, onLoad } = usePhotoAspectRatios([uri]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  return (
    <div
      className={`ui-stack ${classes.cell} ${single ? classes.single : ""} ${width ? classes.slide : ""}`}
      style={{ aspectRatio: ratios[0], ...(width ? { width } : {}) }}
    >
      <Action
        aria-label={`Открыть фото ${index + 1}`}
        onClick={onPhotoPress ? () => onPhotoPress(index) : undefined}
        disabled={!onPhotoPress}
        className={classes.open}
      >
        <Picture
          source={uri}
          // Collection rows enter the nearby window two screens ahead. Native
          // lazy loading inside the clipped scroller can otherwise start late.
          loading={preload && active && nearby ? "eager" : "lazy"}
          retryKey={retry}
          contentFit={contain ? "contain" : "cover"}
          className={classes.picture}
          transition={180}
          fadeOnLoad
          errorFallback={null}
          onLoad={(event) => {
            onLoad(uri)(event);
            onImageLoad?.(event);
            setFailed(false);
          }}
          onError={() => setFailed(true)}
        />
      </Action>
      {failed ? (
        <ImageFailure
          onRetry={() => {
            setFailed(false);
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function ClubPhotoCarousel({
  photos,
  onPhotoPress,
}: {
  photos: string[];
  onPhotoPress?: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const drag = usePhotoMouseDrag(width, photos.length);
  useCollectionItemRetention(index > 0);
  return (
    <MeasuredBox
      className={`ui-stack ${classes.carousel}`}
      role="region"
      aria-label="Фотографии поста"
      onResize={({ width: next }) => {
        if (next > 0 && next !== width) {
          setWidth(next);
          scroll.current?.scrollTo({ left: index * next, behavior: "instant" });
        }
      }}
    >
      {width > 0 ? (
        <ScrollArea
          {...drag}
          mouseDrag={false}
          ref={scroll}
          horizontal
          paging
          hideScrollbar
          className={classes.carouselScroll}
          aria-label="Перелистывание фотографий"
          onScroll={(event) =>
            setIndex(
              Math.min(
                photos.length - 1,
                Math.max(0, Math.round(event.currentTarget.scrollLeft / width)),
              ),
            )
          }
          onKeyDown={(event) =>
            scrollPhotoWithKeyboard(event, width, photos.length)
          }
        >
          {photos.map((uri, position) => (
            <ClubPhoto
              key={`${uri}-${position}`}
              uri={uri}
              index={position}
              width={width}
              contain
              preload={Math.abs(position - index) <= 1}
              onPhotoPress={onPhotoPress}
            />
          ))}
        </ScrollArea>
      ) : (
        <ClubPhoto
          uri={photos[0]}
          index={0}
          single
          contain
          onPhotoPress={onPhotoPress}
        />
      )}
      <div className={`ui-stack ${classes.counter}`}>
        <Typography className={classes.counterText}>
          {index + 1} / {photos.length}
        </Typography>
      </div>
    </MeasuredBox>
  );
}

export function ClubPostPhotos({
  photos,
  videos,
  onPhotoPress,
}: {
  photos: string[];
  videos: PostVideoSlide[];
  onPhotoPress?: (index: number) => void;
}) {
  const pair = photos.length === 2 && videos.length === 0;
  const { ratios, onLoad } = usePhotoAspectRatios(pair ? photos : []);
  const landscapePair = pair && ratios.every((ratio) => ratio > 1);
  if (videos.length > 1)
    return (
      <div className={`ui-stack ${classes.stack}`}>
        <PostVideoCarousel videos={videos} />
        {photos.length > 0 ? (
          <ClubPostPhotos
            photos={photos}
            videos={[]}
            onPhotoPress={onPhotoPress}
          />
        ) : null}
      </div>
    );
  const video = videos[0];
  if (!photos.length)
    return video ? (
      <VideoGridCell
        url={video.url}
        thumbnailUrl={video.posterUrl}
        standalone
      />
    ) : null;
  if (!video && photos.length > 9)
    return <ClubPhotoCarousel photos={photos} onPhotoPress={onPhotoPress} />;
  if (!video && photos.length === 1)
    return (
      <ClubPhoto
        key={photos[0]}
        uri={photos[0]}
        index={0}
        single
        onPhotoPress={onPhotoPress}
      />
    );
  const rows: { indices: number[]; columns: number }[] = [];
  if (video) {
    rows.push({
      indices: photos.slice(0, 2).map((_, index) => index),
      columns: 3,
    });
    for (let offset = 2; offset < photos.length; offset += 4)
      rows.push({
        indices: photos
          .slice(offset, offset + 4)
          .map((_, index) => offset + index),
        columns: Math.min(4, photos.length - offset),
      });
  } else {
    for (const indices of postPhotoRows(photos.length))
      rows.push({ indices, columns: indices.length });
  }
  return (
    <div
      className={`ui-stack ${classes.stack}`}
      role="group"
      aria-label="Фотографии поста"
    >
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`ui-stack ${classes.row} ${landscapePair ? classes.landscapePair : ""}`}
        >
          {video && rowIndex === 0 ? (
            <VideoGridCell url={video.url} thumbnailUrl={video.posterUrl} />
          ) : null}
          {row.indices.map((index) => (
            <ClubPhoto
              key={`${photos[index]}-${index}`}
              uri={photos[index]}
              index={index}
              onImageLoad={pair ? onLoad(photos[index]) : undefined}
              onPhotoPress={onPhotoPress}
            />
          ))}
          {Array.from(
            {
              length:
                row.columns -
                row.indices.length -
                (video && rowIndex === 0 ? 1 : 0),
            },
            (_, index) => (
              <div
                key={`empty-${index}`}
                aria-hidden="true"
                className={`ui-stack ${classes.cell}`}
                style={{ aspectRatio: FALLBACK_PHOTO_RATIO } as CSSProperties}
              />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
