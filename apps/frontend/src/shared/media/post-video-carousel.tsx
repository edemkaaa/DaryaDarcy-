"use client";
/** Несколько роликов поста показываем в одной последовательности, сохраняя управление выбранным элементом. */
import { useLayoutEffect, useRef, useState } from "react";
import { MeasuredBox, ScrollArea, Typography } from "@/shared/ui/elements";
import { useCollectionItemRetention } from "@/shared/ui/collection-item-window";
import { PhotoDots } from "./photo-dots";
import { VideoGridCell } from "./video-grid-cell";
import {
  scrollPhotoTo,
  scrollPhotoWithKeyboard,
} from "./photo-carousel-navigation";
import { usePhotoMouseDrag } from "./use-photo-mouse-drag";
import frameClasses from "./post-photo-frame.module.scss";
import photoClasses from "./post-photo-carousel.module.scss";
import classes from "./post-video-carousel.module.scss";

export type PostVideoSlide = { url: string; posterUrl?: string };

export function PostVideoCarousel({ videos }: { videos: PostVideoSlide[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const currentIndex = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const mouseDrag = usePhotoMouseDrag(width, videos.length);
  useCollectionItemRetention(index > 0);
  useLayoutEffect(() => {
    const preserved = Math.min(
      currentIndex.current,
      Math.max(videos.length - 1, 0),
    );
    currentIndex.current = preserved;
    setIndex(preserved);
    scrollRef.current?.scrollTo({
      left: preserved * width,
      behavior: "instant",
    });
  }, [width, videos.length]);
  const navigate = (next: number) =>
    scrollPhotoTo(scrollRef.current, width, videos.length, next);
  if (!videos.length) return null;
  return (
    <MeasuredBox
      role="region"
      aria-label="Видео поста"
      className={classes.wrap}
      onClick={(event) => event.stopPropagation()}
      onResize={({ width: next }) => {
        if (next > 0 && next !== width) setWidth(next);
      }}
    >
      <div className={`${frameClasses.frame} ${classes.viewport}`}>
        <ScrollArea
          {...mouseDrag}
          mouseDrag={false}
          ref={scrollRef}
          horizontal
          paging
          hideScrollbar
          aria-label="Перелистывание видео"
          onPointerDown={(event) => {
            // Leave native player controls, including the seek bar, to the player.
            if ((event.target as Element).closest("video, iframe")) return;
            mouseDrag.onPointerDown(event);
          }}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget)
              scrollPhotoWithKeyboard(event, width, videos.length);
          }}
          onScroll={(event) => {
            if (width <= 0) return;
            const next = Math.min(
              Math.max(Math.round(event.currentTarget.scrollLeft / width), 0),
              videos.length - 1,
            );
            currentIndex.current = next;
            setIndex(next);
          }}
        >
          {videos.map((video, position) => (
            <div
              key={`${position}-${video.url}`}
              className={classes.slide}
              style={{ width: width || "100%" }}
              inert={position !== index}
              aria-hidden={position !== index}
              data-video-slide={position}
            >
              <VideoGridCell
                // Changing the active slide unmounts its player: native media is
                // paused/released, and a VK iframe is removed rather than hidden.
                key={`${position === index ? "active" : "preview"}-${video.url}`}
                url={video.url}
                thumbnailUrl={
                  Math.abs(position - index) <= 1 ? video.posterUrl : undefined
                }
                fillCell
              />
            </div>
          ))}
        </ScrollArea>
        {videos.length > 1 ? (
          <>
            <div
              className={`ui-stack ${photoClasses.counter} ${classes.counter}`}
            >
              <Typography
                className={photoClasses.counterText}
                aria-live="polite"
                aria-atomic="true"
              >
                {index + 1} / {videos.length}
              </Typography>
            </div>
            <div
              className={classes.indicators}
              aria-label="Свайпните для переключения видео"
              onPointerDown={(event) => {
                if (event.pointerType === "mouse" && event.button !== 0) return;
                swipeStart.current = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                const start = swipeStart.current;
                swipeStart.current = null;
                if (!start || start.id !== event.pointerId) return;
                const dx = start.x - event.clientX;
                if (
                  Math.abs(dx) >= 40 &&
                  Math.abs(dx) > Math.abs(start.y - event.clientY)
                )
                  navigate(index + Math.sign(dx));
              }}
              onPointerCancel={() => {
                swipeStart.current = null;
              }}
              onLostPointerCapture={() => {
                swipeStart.current = null;
              }}
            >
              <PhotoDots
                count={videos.length}
                index={index}
                className={photoClasses.dots}
                label={`Видео ${index + 1} из ${videos.length}`}
              />
            </div>
          </>
        ) : null}
      </div>
    </MeasuredBox>
  );
}
