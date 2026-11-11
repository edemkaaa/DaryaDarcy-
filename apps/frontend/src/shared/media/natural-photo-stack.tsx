"use client";
/** Стек фотографий использует известные пропорции и общую навигацию, чтобы не растягивать снимки до произвольной высоты. */
import classes from "./natural-photo-stack.module.scss";
import frameClasses from "./post-photo-frame.module.scss";
import { PhotoTile } from "./photo-tile";
import { imageSlotSizes } from "./image-sizes";
import { usePhotoAspectRatios } from "./photo-aspect-ratios";
import { postPhotoRows } from "./post-photo-rows";
import { PostPhotoCarousel } from "@/shared/media/post-photo-carousel";
import { VideoGridCell } from "@/shared/media/video-grid-cell";
import { PostVideoCarousel, type PostVideoSlide } from "./post-video-carousel";
export interface VideoGridSlot {
  url: string;
  thumbnailUrl?: string;
}
export function NaturalPhotoStack({
  photos,
  onPhotoPress,
  video,
  posterUrl,
  videos,
}: {
  photos: string[];
  onPhotoPress?: (index: number) => void;
  video?: VideoGridSlot;
  posterUrl?: string;
  videos?: PostVideoSlide[];
}) {
  const pair = photos.length === 2 && !video && !videos?.length;
  const { ratios, onLoad } = usePhotoAspectRatios(pair ? photos : []);
  const landscapePair = pair && ratios.every((ratio) => ratio > 1);
  if (videos && videos.length > 1) {
    return (
      <div className="ui-stack">
        <PostVideoCarousel videos={videos} />
        {photos.length ? (
          <NaturalPhotoStack photos={photos} onPhotoPress={onPhotoPress} />
        ) : null}
      </div>
    );
  }
  if (videos?.length) {
    video = { url: videos[0].url, thumbnailUrl: videos[0].posterUrl };
    posterUrl = videos[0].posterUrl;
  }
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
    : postPhotoRows(photos.length).map((row) =>
        row.map((index) => indices[index]),
      );
  return (
    <div
      className={`ui-stack ${frameClasses.frame}`}
      role="group"
      aria-label="Фотографии поста"
      data-post-photo-frame
    >
      <div className={`ui-stack ${classes.grid}`}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`ui-stack ${classes.row} ${landscapePair ? classes.landscapePair : ""}`}
            style={
              !video ? { flexGrow: photos.length / row.length } : undefined
            }
          >
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
              <PhotoTile
                key={index}
                uri={uri}
                sizes={imageSlotSizes(
                  landscapePair
                    ? 1
                    : row.length + (video && rowIndex === 0 ? 1 : 0),
                )}
                className={classes.cell}
                onLoad={pair ? onLoad(uri) : undefined}
                onPhotoPress={
                  onPhotoPress ? () => onPhotoPress(index) : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
