import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { MoodboardItem } from "@/lib/moodboard/types";
import { MOODBOARD_BROWN_DARK, MOODBOARD_CREAM, MOODBOARD_RIBBON } from "@/lib/moodboard/constants";
import {
  MOODBOARD_RIBBON_GAP,
  MOODBOARD_RIBBON_HEIGHT,
  MOODBOARD_RIBBON_PADDING_V,
  MOODBOARD_RIBBON_THUMB,
} from "@/lib/moodboard/ribbon-layout";

function confirmRemove(onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm("Удалить фото с доски?")) onConfirm();
    return;
  }
  Alert.alert("Удалить фото?", "Изображение будет убрано с доски.", [
    { text: "Отмена", style: "cancel" },
    { text: "Удалить", style: "destructive", onPress: onConfirm },
  ]);
}

type Props = {
  items: MoodboardItem[];
  onReorder: (items: MoodboardItem[]) => void;
  onRemove: (id: string) => void;
};

function DraggableThumb({
  item,
  index,
  reorderMode,
  dragIndex,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  item: MoodboardItem;
  index: number;
  reorderMode: boolean;
  dragIndex: number | null;
  onDragStart: (index: number) => void;
  onDragEnd: (index: number, dx: number) => void;
  onRemove: (id: string) => void;
}) {
  const tx = useSharedValue(0);
  const dragging = dragIndex === index;

  const pan = Gesture.Pan()
    .enabled(reorderMode)
    .onBegin(() => {
      runOnJS(onDragStart)(index);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
    })
    .onFinalize((e) => {
      tx.value = 0;
      runOnJS(onDragEnd)(index, e.translationX);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragging ? tx.value : 0 }],
    zIndex: dragging ? 10 : 1,
    opacity: dragging ? 0.92 : 1,
  }));

  const content = (
    <Animated.View style={[styles.thumbWrap, animStyle]}>
      <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
      <Pressable
        style={styles.thumbRemove}
        onPress={() => confirmRemove(() => onRemove(item.id))}
      >
        <MaterialIcons name="close" size={14} color={MOODBOARD_CREAM} />
      </Pressable>
    </Animated.View>
  );

  if (!reorderMode) return content;
  return <GestureDetector gesture={pan}>{content}</GestureDetector>;
}

export function MoodboardRibbon({ items, onReorder, onRemove }: Props) {
  const [reorderMode, setReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const swapToIndex = useCallback(
    (from: number, to: number) => {
      if (from === to || to < 0 || to >= itemsRef.current.length) return;
      const next = [...itemsRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next);
    },
    [onReorder],
  );

  const onDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const onDragEnd = useCallback(
    (index: number, dx: number) => {
      const step = MOODBOARD_RIBBON_THUMB + MOODBOARD_RIBBON_GAP;
      const shift = Math.round(dx / step);
      if (shift !== 0) swapToIndex(index, index + shift);
      setDragIndex(null);
    },
    [swapToIndex],
  );

  return (
    <View style={styles.ribbon}>
      <Pressable
        onPress={() => setReorderMode((v) => !v)}
        style={[styles.orderBtn, reorderMode && styles.orderBtnActive]}
        accessibilityLabel="Порядок"
      >
        <MaterialIcons name="swap-vert" size={32} color={MOODBOARD_CREAM} />
        <Text style={styles.orderLabel}>Порядок</Text>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbsRow}
        style={styles.thumbsScroll}
      >
        {items.map((item, index) => (
          <DraggableThumb
            key={item.id}
            item={item}
            index={index}
            reorderMode={reorderMode}
            dragIndex={dragIndex}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onRemove={onRemove}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    width: "100%",
    backgroundColor: MOODBOARD_RIBBON,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: MOODBOARD_RIBBON_PADDING_V,
    paddingLeft: 8,
    paddingRight: 12,
    minHeight: MOODBOARD_RIBBON_HEIGHT,
  },
  orderBtn: {
    width: 64,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  orderBtnActive: { opacity: 0.75 },
  orderLabel: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: MOODBOARD_CREAM,
    marginTop: 6,
  },
  thumbsScroll: { flex: 1 },
  thumbsRow: { gap: MOODBOARD_RIBBON_GAP, alignItems: "center", paddingRight: 4 },
  thumbWrap: {
    width: MOODBOARD_RIBBON_THUMB,
    height: MOODBOARD_RIBBON_THUMB,
    borderRadius: 8,
    position: "relative",
  },
  thumb: {
    width: MOODBOARD_RIBBON_THUMB,
    height: MOODBOARD_RIBBON_THUMB,
    borderRadius: 8,
  },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: MOODBOARD_BROWN_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
});
