"use client";
import classes from "./natural-photo-stack.module.scss";
import frameClasses from "./post-photo-frame.module.scss";
import { Action } from "@/shared/ui/elements";
import { type ReactNode } from "react";
import { Picture } from "@/shared/media/image";
import { PostPhotoCarousel } from "@/shared/media/post-photo-carousel";
import { VideoGridCell } from "@/shared/media/video-grid-cell";
export interface VideoGridSlot {
  url: string;
  thumbnailUrl?: string;
}
function Cell({ uri, onClick }: { uri: string; onClick?: () => void }) {
  return (
    <Action
      aria-label="Открыть фото"
      disabled={!onClick}
      onClick={onClick}
      className={({ pressed }) =>
        [classes.cell, pressed ? classes.opacityState : ""]
          .filter(Boolean)
          .join(" ")
      }
    >
      <Picture
        source={{ uri }}
        contentFit="cover"
        transition={180}
        fadeOnLoad
        className={classes.picture}
      />
    </Action>
  );
}
function Row({ children }: { children: ReactNode }) {
  return <div className={`ui-stack ${classes.row}`}>{children}</div>;
}
function photoRows(photos: string[]): string[][] {
  if (photos.length === 7) return [photos.slice(0, 3), photos.slice(3)];
  const columns =
    photos.length <= 3
      ? photos.length
      : photos.length === 4
        ? 2
        : photos.length === 8
          ? 4
          : 3;
  const rows: string[][] = [];
  for (let i = 0; i < photos.length; i += columns)
    rows.push(photos.slice(i, i + columns));
  return rows;
}
export function NaturalPhotoStack({
  photos,
  onPhotoPress,
  video,
  posterUrl,
}: {
  photos: string[];
  onPhotoPress?: (index: number) => void;
  video?: VideoGridSlot;
  posterUrl?: string;
}) {
  if (!photos.length && !video) return null;
  if (video && !photos.length) {
    return (
      <VideoGridCell
        url={video.url}
        thumbnailUrl={posterUrl ?? video.thumbnailUrl}
        standalone
      />
    );
  }
  if (!video && photos.length > 9) {
    return <PostPhotoCarousel photos={photos} onPhotoPress={onPhotoPress} />;
  }
  // Indices stay attached to the original list, including photos after video.
  const indices = photos.map((uri, index) => ({ uri, index }));
  const rows = video
    ? [
        indices.slice(0, 2),
        ...Array.from(
          { length: Math.ceil(Math.max(photos.length - 2, 0) / 4) },
          (_, row) => indices.slice(2 + row * 4, 6 + row * 4),
        ),
      ]
    : photoRows(photos).map((row, rowIndex, allRows) => {
        const offset = allRows
          .slice(0, rowIndex)
          .reduce((count, items) => count + items.length, 0);
        return row.map((uri, index) => ({ uri, index: offset + index }));
      });
  return (
    <div
      className={`ui-stack ${frameClasses.frame}`}
      role="group"
      aria-label="Фотографии поста"
      data-post-photo-frame
    >
      <div className={`ui-stack ${classes.grid}`}>
        {rows.map((row, rowIndex) => (
          <Row key={rowIndex}>
            {video && rowIndex === 0 ? (
              <div className={`ui-stack ${classes.cell}`}>
                <VideoGridCell
                  url={video.url}
                  thumbnailUrl={posterUrl ?? video.thumbnailUrl}
                  fillCell
                />
              </div>
            ) : null}
            {row.map(({ uri, index }) => (
              <Cell
                key={index}
                uri={uri}
                onClick={onPhotoPress ? () => onPhotoPress(index) : undefined}
              />
            ))}
          </Row>
        ))}
      </div>
    </div>
  );
}
