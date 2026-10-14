"use client";
import classes from "./post-photo-carousel.module.scss";
import frameClasses from "./post-photo-frame.module.scss";
import {
  type ScrollEvent,
  MeasuredBox,
  ScrollArea,
  Typography,
} from "@/shared/ui/elements";
import { useLayoutEffect, useRef, useState } from "react";
import { useCollectionItemRetention } from "@/shared/ui/collection-item-window";
import { Picture } from "@/shared/media/image";
import { PhotoTile } from "./photo-tile";
import { PhotoDots } from "./photo-dots";
import { scrollPhotoWithKeyboard } from "./photo-carousel-navigation";
import { usePhotoMouseDrag } from "./use-photo-mouse-drag";
export function PostPhotoCarousel({
  photos,
  onPhotoPress,
}: {
  photos: string[];
  onPhotoPress?: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  useCollectionItemRetention(index > 0);
  const currentIndex = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mouseDrag = usePhotoMouseDrag(width, photos.length);
  useLayoutEffect(() => {
    const preserved = Math.min(
      currentIndex.current,
      Math.max(photos.length - 1, 0),
    );
    currentIndex.current = preserved;
    setIndex(preserved);
    scrollRef.current?.scrollTo({
      left: preserved * width,
      behavior: "instant",
    });
  }, [width, photos.length]);
  const onScroll = (event: ScrollEvent) => {
    if (width <= 0 || !photos.length) return;
    const next = Math.round(event.currentTarget.scrollLeft / width);
    const safeIndex = Math.min(Math.max(next, 0), photos.length - 1);
    currentIndex.current = safeIndex;
    if (safeIndex !== index) setIndex(safeIndex);
  };
  if (!photos.length) return null;
  return (
    <MeasuredBox
      role="region"
      aria-label="Фотографии поста"
      onResize={(event) => {
        const nextWidth = event.width;
        if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth);
      }}
      className={`${frameClasses.frame} ${classes.wrap}`}
      data-post-photo-frame
    >
      {width > 0 ? (
        <ScrollArea
          {...mouseDrag}
          ref={scrollRef}
          horizontal
          paging
          hideScrollbar
          onScroll={onScroll}
          aria-label="Перелистывание фотографий"
          onKeyDown={(event) =>
            scrollPhotoWithKeyboard(event, width, photos.length)
          }
        >
          {photos.map((uri, photoIndex) => (
            <PhotoTile
              key={`${uri}-${photoIndex}`}
              uri={Math.abs(photoIndex - index) <= 1 ? uri : undefined}
              onPhotoPress={
                onPhotoPress ? () => onPhotoPress(photoIndex) : undefined
              }
              label={`Открыть фото ${photoIndex + 1} из ${photos.length}`}
              style={{
                width: width,
                height: "100%",
              }}
              className={classes.action}
            />
          ))}
        </ScrollArea>
      ) : (
        <div
          style={{ height: "100%" }}
          className={["ui-stack ", classes.action].filter(Boolean).join(" ")}
        >
          <Picture
            source={{ uri: photos[0] }}
            contentFit="cover"
            transition={180}
            fadeOnLoad
            className={classes.picture}
          />
        </div>
      )}
      {photos.length > 1 ? (
        <div
          className={["ui-stack ", classes.counter].filter(Boolean).join(" ")}
        >
          <Typography className={classes.counterText}>
            {index + 1} / {photos.length}
          </Typography>
        </div>
      ) : null}
      <PhotoDots count={photos.length} index={index} className={classes.dots} />
    </MeasuredBox>
  );
}
