"use client";
import classes from "./natural-photo-stack.module.scss";
import { mergeStyles } from "@/shared/ui/css";
import { Action } from "@/shared/ui/elements";
import { type ReactNode } from "react";
import { Picture } from "@/shared/media/image";
import { PostPhotoCarousel } from "@/shared/media/post-photo-carousel";
import { VideoGridCell } from "@/shared/media/video-grid-cell";
import { POST_PHOTO_RATIO, POST_PHOTO_FIT } from "./post-photo-layout";
export interface VideoGridSlot {
  url: string;
  thumbnailUrl?: string;
}
function Cell({
  uri,
  onClick,
  style,
}: {
  uri: string;
  onClick?: () => void;
  style?: object;
}) {
  return (
    <Action
      aria-label="Открыть фото"
      disabled={!onClick}
      onClick={onClick}
      style={mergeStyles({ aspectRatio: POST_PHOTO_RATIO }, style)}
      className={classes.action}
    >
      <Picture
        source={{ uri }}
        contentFit={POST_PHOTO_FIT}
        className={classes.picture}
      />
    </Action>
  );
}
function Row({ children }: { children: ReactNode }) {
  return (
    <div className={["ui-stack ", classes.row].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
function PhotoGrid({
  photos,
  press,
  columns,
}: {
  photos: string[];
  press: (index: number) => (() => void) | undefined;
  columns: number;
}) {
  const rows: string[][] = [];
  for (let i = 0; i < photos.length; i += columns) {
    rows.push(photos.slice(i, i + columns));
  }
  return (
    <div className={["ui-stack ", classes.stackCol].filter(Boolean).join(" ")}>
      {rows.map((row, rowIndex) => (
        <Row key={`row-${rowIndex}`}>
          {row.map((uri, colIndex) => {
            const index = rowIndex * columns + colIndex;
            return <Cell key={index} uri={uri} onClick={press(index)} />;
          })}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, i) => (
                <div
                  key={`pad-${i}`}
                  className={["ui-stack ", classes.div]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))
            : null}
        </Row>
      ))}
    </div>
  );
}
function VideoPhotoGrid({
  video,
  photos,
  press,
}: {
  video: VideoGridSlot;
  photos: string[];
  press: (index: number) => (() => void) | undefined;
}) {
  const topPhotos = photos.slice(0, 2);
  const bottomPhotos = photos.slice(2);
  return (
    <div className={["ui-stack ", classes.stackCol].filter(Boolean).join(" ")}>
      <Row>
        <VideoGridCell url={video.url} thumbnailUrl={video.thumbnailUrl} />
        {topPhotos.map((uri, index) => (
          <Cell key={`top-${index}`} uri={uri} onClick={press(index)} />
        ))}
        {topPhotos.length < 2
          ? Array.from({ length: 2 - topPhotos.length }).map((_, i) => (
              <div
                key={`top-pad-${i}`}
                className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
              />
            ))
          : null}
      </Row>
      {bottomPhotos.length > 0 ? (
        <Row>
          {bottomPhotos.slice(0, 4).map((uri, index) => (
            <Cell
              key={`bottom-${index}`}
              uri={uri}
              onClick={press(index + 2)}
            />
          ))}
        </Row>
      ) : null}
      {bottomPhotos.length > 4 ? (
        <PhotoGrid
          photos={bottomPhotos.slice(4)}
          press={(index) => press(index + 6)}
          columns={4}
        />
      ) : null}
    </div>
  );
}
function SinglePhoto({ uri, onClick }: { uri: string; onClick?: () => void }) {
  return (
    <Action
      aria-label="Открыть фото"
      disabled={!onClick}
      onClick={onClick}
      className={({ pressed }) => (pressed ? classes.opacityState : "")}
    >
      <Picture
        source={{ uri }}
        style={{ aspectRatio: POST_PHOTO_RATIO }}
        contentFit={POST_PHOTO_FIT}
        className={classes.picture2}
      />
    </Action>
  );
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
  const press = (index: number) =>
    onPhotoPress ? () => onPhotoPress(index) : undefined;
  if (video && photos.length > 0) {
    return (
      <VideoPhotoGrid
        video={{
          url: video.url,
          thumbnailUrl: posterUrl ?? video.thumbnailUrl,
        }}
        photos={photos}
        press={press}
      />
    );
  }
  if (video && photos.length === 0) {
    return (
      <VideoGridCell
        url={video.url}
        thumbnailUrl={posterUrl ?? video.thumbnailUrl}
        standalone
      />
    );
  }
  if (photos.length > 9) {
    return <PostPhotoCarousel photos={photos} onPhotoPress={onPhotoPress} />;
  }
  if (photos.length === 1) {
    return <SinglePhoto uri={photos[0]} onClick={press(0)} />;
  }
  if (photos.length === 2) {
    return (
      <div
        className={["ui-stack ", classes.stackCol].filter(Boolean).join(" ")}
      >
        <Row>
          <Cell uri={photos[0]} onClick={press(0)} />
          <Cell uri={photos[1]} onClick={press(1)} />
        </Row>
      </div>
    );
  }
  if (photos.length === 3) {
    return (
      <div
        className={["ui-stack ", classes.stackCol].filter(Boolean).join(" ")}
      >
        <Row>
          <Cell uri={photos[0]} onClick={press(0)} />
          <Cell uri={photos[1]} onClick={press(1)} />
          <Cell uri={photos[2]} onClick={press(2)} />
        </Row>
      </div>
    );
  }
  if (photos.length === 4) {
    return <PhotoGrid photos={photos} press={press} columns={2} />;
  }
  if (photos.length <= 6) {
    return <PhotoGrid photos={photos} press={press} columns={3} />;
  }
  if (photos.length === 7) {
    return (
      <div
        className={["ui-stack ", classes.stackCol].filter(Boolean).join(" ")}
      >
        <Row>
          <Cell uri={photos[0]} onClick={press(0)} />
          <Cell uri={photos[1]} onClick={press(1)} />
          <Cell uri={photos[2]} onClick={press(2)} />
        </Row>
        <Row>
          <Cell uri={photos[3]} onClick={press(3)} />
          <Cell uri={photos[4]} onClick={press(4)} />
          <Cell uri={photos[5]} onClick={press(5)} />
          <Cell uri={photos[6]} onClick={press(6)} />
        </Row>
      </div>
    );
  }
  if (photos.length === 8) {
    return (
      <div
        className={["ui-stack ", classes.stackCol].filter(Boolean).join(" ")}
      >
        <Row>
          <Cell uri={photos[0]} onClick={press(0)} />
          <Cell uri={photos[1]} onClick={press(1)} />
          <Cell uri={photos[2]} onClick={press(2)} />
          <Cell uri={photos[3]} onClick={press(3)} />
        </Row>
        <Row>
          <Cell uri={photos[4]} onClick={press(4)} />
          <Cell uri={photos[5]} onClick={press(5)} />
          <Cell uri={photos[6]} onClick={press(6)} />
          <Cell uri={photos[7]} onClick={press(7)} />
        </Row>
      </div>
    );
  }
  return <PhotoGrid photos={photos} press={press} columns={3} />;
}
