"use client";
import classes from "./post-photo-carousel.module.scss";
import {
  type ScrollEvent,
  MeasuredBox,
  ScrollArea,
  Action,
  Typography,
} from "@/shared/ui/elements";
import { useLayoutEffect, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import {
  FALLBACK_PHOTO_RATIO,
  usePhotoAspectRatios,
} from "@/shared/media/photo-aspect-ratios";
export function PostPhotoCarousel({
  photos,
  onPhotoPress,
}: {
  photos: string[];
  onPhotoPress?: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const currentIndex = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const aspectRatios = usePhotoAspectRatios(photos);
  const onScroll = (event: ScrollEvent) => {
    if (width <= 0) return;
    const next = Math.round(event.currentTarget.scrollLeft / width);
    const safeIndex = Math.min(Math.max(next, 0), photos.length - 1);
    currentIndex.current = safeIndex;
    if (safeIndex !== index) setIndex(safeIndex);
  };
  if (!photos.length) return null;
  return (
    <MeasuredBox
      onResize={(event) => {
        const nextWidth = event.width;
        if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth);
      }}
      className={classes.wrap}
    >
      {width > 0 ? (
        <ScrollArea
          ref={scrollRef}
          horizontal
          paging
          hideScrollbar
          onScroll={onScroll}
        >
          {photos.map((uri, photoIndex) => (
            <Action
              key={`${uri}-${photoIndex}`}
              onClick={() => onPhotoPress?.(photoIndex)}
              style={() => ({
                width: width,
                aspectRatio: aspectRatios[photoIndex] ?? FALLBACK_PHOTO_RATIO,
              })}
              className={({ pressed }) =>
                [classes.action, pressed ? classes.opacityState : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <Picture
                source={{ uri }}
                contentFit="contain"
                className={classes.picture}
              />
            </Action>
          ))}
        </ScrollArea>
      ) : (
        <div
          style={{ aspectRatio: aspectRatios[0] ?? FALLBACK_PHOTO_RATIO }}
          className={["ui-stack ", classes.action].filter(Boolean).join(" ")}
        >
          <Picture
            source={{ uri: photos[0] }}
            contentFit="contain"
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
    </MeasuredBox>
  );
}
