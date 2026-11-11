// Архив Expo. Ограничивает drag-координату на UI-потоке Reanimated; директива worklet остаётся первой инструкцией.
import { useEffect } from "react";
import { Image } from "expo-image";
import { Platform, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { MoodboardItem } from "@/lib/moodboard/types";

type Props = {
  item: MoodboardItem;
  canvasWidth: number;
  canvasHeight: number;
  onChange: (patch: Partial<MoodboardItem>) => void;
};

function clamp(value: number, min: number, max: number) {
  // Ограничивает drag-координату на UI-потоке Reanimated; директива worklet остаётся первой инструкцией.

  "worklet";
  return Math.min(Math.max(value, min), max);
}

function isCutoutItem(item: MoodboardItem): boolean {
  // Сохраняет прозрачные cutout без crop по явной метке или PNG-расширению.

  if (item.cutout) return true;
  return /\.png(\?|$)/i.test(item.uri);
}

/** Пока только перетаскивание; масштаб на доске отключён до отдельного UX. */
export function BoardItem({ item, canvasWidth, canvasHeight, onChange }: Props) {
  // Перетаскивает фото внутри рабочей области и передаёт итог в JS только в конце жеста.

  const cutout = isCutoutItem(item);
  const x = useSharedValue(item.x);
  const y = useSharedValue(item.y);
  const w = useSharedValue(item.width);
  const h = useSharedValue(item.height);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const cw = useSharedValue(canvasWidth);
  const ch = useSharedValue(canvasHeight);

  useEffect(() => {
    // Согласует shared values с размером доски и ограничивает элемент обновлёнными границами.

    cw.value = canvasWidth;
    ch.value = canvasHeight;
    x.value = Math.min(item.x, Math.max(0, canvasWidth - item.width));
    y.value = Math.min(item.y, Math.max(0, canvasHeight - item.height));
    w.value = Math.min(item.width, canvasWidth);
    h.value = Math.min(item.height, canvasHeight);
  }, [item.x, item.y, item.width, item.height, canvasWidth, canvasHeight, cw, ch, h, w, x, y]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = clamp(startX.value + e.translationX, 0, cw.value - w.value);
      y.value = clamp(startY.value + e.translationY, 0, ch.value - h.value);
    })
    .onEnd(() => {
      runOnJS(onChange)({ x: x.value, y: y.value });
    });

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[style, styles.item, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit={cutout ? "contain" : "cover"}
        />
      </Animated.View>
    </GestureDetector>
  );
}

// Абсолютные координаты элемента соответствуют рабочей области; прозрачный фон не перекрывает нижние слои доски.
const styles = StyleSheet.create({
  item: { backgroundColor: "transparent" },
  image: { width: "100%", height: "100%", backgroundColor: "transparent" },
});
