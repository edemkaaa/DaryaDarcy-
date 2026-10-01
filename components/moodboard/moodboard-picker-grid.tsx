import { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  type ImageStyle,
} from "react-native";
import { Image } from "expo-image";
import type { MoodboardCatalogImage } from "@/lib/moodboard/types";
import { MOODBOARD_BROWN } from "@/lib/moodboard/constants";

const { width: SCREEN_W } = Dimensions.get("window");
/** Same rhythm as library masonry cards */
export const MOODBOARD_GRID_GAP = 8;
export const MOODBOARD_TILE_RADIUS = 12;
const H_PADDING = 16;
const COL_W = (Math.min(SCREEN_W, 480) - H_PADDING * 2 - MOODBOARD_GRID_GAP) / 2;

function isCutoutImage(img: MoodboardCatalogImage): boolean {
  if (img.cutout) return true;
  return /\.png(\?|$)/i.test(img.uri);
}

type Props = {
  images: MoodboardCatalogImage[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  contentPaddingBottom?: number;
};

export function MoodboardPickerGrid({
  images,
  selected,
  onToggle,
  contentPaddingBottom = 120,
}: Props) {
  const { leftCol, rightCol } = useMemo(() => {
    const left: MoodboardCatalogImage[] = [];
    const right: MoodboardCatalogImage[] = [];
    let leftH = 0;
    let rightH = 0;
    for (const img of images) {
      const h = COL_W / img.aspect;
      if (leftH <= rightH) {
        left.push(img);
        leftH += h + MOODBOARD_GRID_GAP;
      } else {
        right.push(img);
        rightH += h + MOODBOARD_GRID_GAP;
      }
    }
    return { leftCol: left, rightCol: right };
  }, [images]);

  const renderTile = (img: MoodboardCatalogImage) => {
    const h = COL_W / img.aspect;
    const picked = selected.has(img.id);
    const cutout = isCutoutImage(img);
    const imageStyle: ImageStyle = cutout
      ? { width: "100%", height: "100%", backgroundColor: "#EFE6D6" }
      : StyleSheet.absoluteFillObject;

    return (
      <Pressable
        key={img.id}
        onPress={() => onToggle(img.id)}
        style={[
          styles.tileOuter,
          { width: COL_W, height: h },
          picked && styles.tileOuterSelected,
        ]}
      >
        <View style={[styles.tileInner, cutout && styles.tileInnerCutout]}>
          <Image
            source={{ uri: img.uri }}
            style={imageStyle}
            contentFit={cutout ? "contain" : "cover"}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.grid, { paddingBottom: contentPaddingBottom }]}
    >
      <View style={styles.col}>{leftCol.map(renderTile)}</View>
      <View style={styles.col}>{rightCol.map(renderTile)}</View>
    </ScrollView>
  );
}

export function MoodboardPickerFooter({
  selectedCount,
  onAdd,
  disabled,
}: {
  selectedCount: number;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.counter}>Выбрано: {selectedCount}</Text>
      <Pressable
        onPress={onAdd}
        disabled={disabled || selectedCount === 0}
        style={({ pressed }) => [
          styles.addBtn,
          (disabled || selectedCount === 0) && styles.addBtnDisabled,
          pressed && selectedCount > 0 && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.addBtnText}>Добавить</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
    gap: MOODBOARD_GRID_GAP,
    alignSelf: "center",
    maxWidth: 480,
    width: "100%",
  },
  col: { flex: 1, gap: MOODBOARD_GRID_GAP },
  tileOuter: {
    borderRadius: MOODBOARD_TILE_RADIUS,
    padding: 0,
  },
  tileOuterSelected: {
    borderWidth: 3,
    borderColor: MOODBOARD_BROWN,
  },
  tileInner: {
    flex: 1,
    borderRadius: MOODBOARD_TILE_RADIUS - 2,
    overflow: "hidden",
    backgroundColor: "#EFE6D6",
  },
  tileInnerCutout: {
    backgroundColor: "#F7F2EA",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(253, 248, 240, 0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d4c4a8",
  },
  counter: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: MOODBOARD_BROWN,
  },
  addBtn: {
    backgroundColor: MOODBOARD_BROWN,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 16,
    color: "#FDF8F0",
  },
});
