// Архив Expo. Измеряет доступную ширину, листает фотографии страницами и показывает текущий индекс.
import { useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { FALLBACK_PHOTO_RATIO, usePhotoAspectRatios } from "@/lib/photo-aspect-ratios";

export function PostPhotoCarousel({
  photos,
  onPhotoPress,
}: {
  photos: string[];
  onPhotoPress?: (index: number) => void;
}) {
  // Измеряет доступную ширину, листает фотографии страницами и показывает текущий индекс.

  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const aspectRatios = usePhotoAspectRatios(photos);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Переводит горизонтальное смещение в номер страницы только после измерения ширины.

    if (width <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  if (!photos.length) return null;

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth);
      }}
    >
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled
        >
          {photos.map((uri, photoIndex) => (
            <Pressable
              key={`${uri}-${photoIndex}`}
              onPress={() => onPhotoPress?.(photoIndex)}
              style={({ pressed }) => [
                styles.slide,
                { width, aspectRatio: aspectRatios[photoIndex] ?? FALLBACK_PHOTO_RATIO },
                pressed && { opacity: 0.92 },
              ]}
            >
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                cachePolicy="memory-disk"
                recyclingKey={uri}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.slide, { aspectRatio: aspectRatios[0] ?? FALLBACK_PHOTO_RATIO }]}>
          <Image
            source={{ uri: photos[0] }}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={photos[0]}
          />
        </View>
      )}
      {photos.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Рамка имеет измеренную ширину и paging, а счётчик размещён поверх изображения независимо от его пропорций.
const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    position: "relative",
    backgroundColor: "#EDE6DA",
  },
  slide: {
    overflow: "hidden",
    backgroundColor: "#EDE6DA",
  },
  counter: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: "#FDF8F0",
    fontSize: 12,
    fontWeight: "600",
  },
});
