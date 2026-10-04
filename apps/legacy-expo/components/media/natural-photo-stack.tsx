import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { PostPhotoCarousel } from "@/components/media/post-photo-carousel";
import { VideoGridCell } from "@/components/media/video-grid-cell";
import {
  FALLBACK_PHOTO_RATIO,
  getCachedPhotoRatio,
  rememberPhotoRatio,
  usePhotoAspectRatios,
} from "@/lib/photo-aspect-ratios";

const GAP = 1;

export interface VideoGridSlot {
  url: string;
  thumbnailUrl?: string;
}

function Cell({
  uri,
  onPress,
  style,
  aspectRatio = FALLBACK_PHOTO_RATIO,
}: {
  uri: string;
  onPress?: () => void;
  style?: object;
  aspectRatio?: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.cell, { aspectRatio }, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={uri}
      />
    </Pressable>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function PhotoGrid({
  photos,
  press,
  columns,
  ratios,
}: {
  photos: string[];
  press: (index: number) => (() => void) | undefined;
  columns: number;
  ratios: number[];
}) {
  const rows: string[][] = [];
  for (let i = 0; i < photos.length; i += columns) {
    rows.push(photos.slice(i, i + columns));
  }

  return (
    <View style={styles.stackCol}>
      {rows.map((row, rowIndex) => (
        <Row key={`row-${rowIndex}`}>
          {row.map((uri, colIndex) => {
            const index = rowIndex * columns + colIndex;
            return (
              <Cell
                key={index}
                uri={uri}
                onPress={press(index)}
                aspectRatio={ratios[index] ?? FALLBACK_PHOTO_RATIO}
              />
            );
          })}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, i) => (
                <View key={`pad-${i}`} style={[styles.cell, { aspectRatio: FALLBACK_PHOTO_RATIO }]} />
              ))
            : null}
        </Row>
      ))}
    </View>
  );
}

function VideoPhotoGrid({
  video,
  photos,
  press,
  ratios,
}: {
  video: VideoGridSlot;
  photos: string[];
  press: (index: number) => (() => void) | undefined;
  ratios: number[];
}) {
  const topPhotos = photos.slice(0, 2);
  const bottomPhotos = photos.slice(2);

  return (
    <View style={styles.stackCol}>
      <Row>
        <VideoGridCell url={video.url} thumbnailUrl={video.thumbnailUrl} />
        {topPhotos.map((uri, index) => (
          <Cell
            key={`top-${index}`}
            uri={uri}
            onPress={press(index)}
            aspectRatio={ratios[index] ?? FALLBACK_PHOTO_RATIO}
          />
        ))}
        {topPhotos.length < 2
          ? Array.from({ length: 2 - topPhotos.length }).map((_, i) => (
              <View key={`top-pad-${i}`} style={[styles.cell, { aspectRatio: FALLBACK_PHOTO_RATIO }]} />
            ))
          : null}
      </Row>
      {bottomPhotos.length > 0 ? (
        <Row>
          {bottomPhotos.slice(0, 4).map((uri, index) => (
            <Cell
              key={`bottom-${index}`}
              uri={uri}
              onPress={press(index + 2)}
              aspectRatio={ratios[index + 2] ?? FALLBACK_PHOTO_RATIO}
            />
          ))}
        </Row>
      ) : null}
      {bottomPhotos.length > 4 ? (
        <PhotoGrid photos={bottomPhotos.slice(4)} press={press} columns={4} ratios={ratios} />
      ) : null}
    </View>
  );
}

function SinglePhoto({ uri, onPress }: { uri: string; onPress?: () => void }) {
  const [ratio] = usePhotoAspectRatios([uri]);
  const [loadedRatio, setLoadedRatio] = useState<number | null>(
    () => getCachedPhotoRatio(uri) ?? null,
  );
  const displayRatio = loadedRatio ?? ratio;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
      <Image
        source={{ uri }}
        style={[styles.singlePhoto, { aspectRatio: displayRatio }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onLoad={(event) => {
          const { width, height } = event.source;
          const next = rememberPhotoRatio(uri, width, height);
          if (next != null) setLoadedRatio(next);
        }}
      />
    </Pressable>
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
  const ratios = usePhotoAspectRatios(photos);
  if (!photos.length && !video) return null;

  const press = (index: number) => (onPhotoPress ? () => onPhotoPress(index) : undefined);

  if (video && photos.length > 0) {
    return (
      <VideoPhotoGrid
        video={{ url: video.url, thumbnailUrl: posterUrl ?? video.thumbnailUrl }}
        photos={photos}
        press={press}
        ratios={ratios}
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
    return <SinglePhoto uri={photos[0]} onPress={press(0)} />;
  }

  if (photos.length === 2) {
    return (
      <View style={styles.stackCol}>
        <Row>
          <Cell uri={photos[0]} onPress={press(0)} aspectRatio={ratios[0]} />
          <Cell uri={photos[1]} onPress={press(1)} aspectRatio={ratios[1]} />
        </Row>
      </View>
    );
  }

  if (photos.length === 3) {
    return (
      <View style={styles.stackCol}>
        <Row>
          <Cell uri={photos[0]} onPress={press(0)} aspectRatio={ratios[0]} />
          <Cell uri={photos[1]} onPress={press(1)} aspectRatio={ratios[1]} />
          <Cell uri={photos[2]} onPress={press(2)} aspectRatio={ratios[2]} />
        </Row>
      </View>
    );
  }

  if (photos.length === 4) {
    return <PhotoGrid photos={photos} press={press} columns={2} ratios={ratios} />;
  }

  if (photos.length <= 6) {
    return <PhotoGrid photos={photos} press={press} columns={3} ratios={ratios} />;
  }

  if (photos.length === 7) {
    return (
      <View style={styles.stackCol}>
        <Row>
          <Cell uri={photos[0]} onPress={press(0)} aspectRatio={ratios[0]} />
          <Cell uri={photos[1]} onPress={press(1)} aspectRatio={ratios[1]} />
          <Cell uri={photos[2]} onPress={press(2)} aspectRatio={ratios[2]} />
        </Row>
        <Row>
          <Cell uri={photos[3]} onPress={press(3)} aspectRatio={ratios[3]} />
          <Cell uri={photos[4]} onPress={press(4)} aspectRatio={ratios[4]} />
          <Cell uri={photos[5]} onPress={press(5)} aspectRatio={ratios[5]} />
          <Cell uri={photos[6]} onPress={press(6)} aspectRatio={ratios[6]} />
        </Row>
      </View>
    );
  }

  if (photos.length === 8) {
    return (
      <View style={styles.stackCol}>
        <Row>
          <Cell uri={photos[0]} onPress={press(0)} aspectRatio={ratios[0]} />
          <Cell uri={photos[1]} onPress={press(1)} aspectRatio={ratios[1]} />
          <Cell uri={photos[2]} onPress={press(2)} aspectRatio={ratios[2]} />
          <Cell uri={photos[3]} onPress={press(3)} aspectRatio={ratios[3]} />
        </Row>
        <Row>
          <Cell uri={photos[4]} onPress={press(4)} aspectRatio={ratios[4]} />
          <Cell uri={photos[5]} onPress={press(5)} aspectRatio={ratios[5]} />
          <Cell uri={photos[6]} onPress={press(6)} aspectRatio={ratios[6]} />
          <Cell uri={photos[7]} onPress={press(7)} aspectRatio={ratios[7]} />
        </Row>
      </View>
    );
  }

  return <PhotoGrid photos={photos} press={press} columns={3} ratios={ratios} />;
}

const styles = StyleSheet.create({
  stackCol: {
    width: "100%",
    gap: GAP,
  },
  row: {
    flexDirection: "row",
    gap: GAP,
  },
  cell: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#EDE6DA",
  },
  singlePhoto: {
    width: "100%",
    backgroundColor: "#EDE6DA",
  },
});
