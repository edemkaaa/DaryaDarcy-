import { View, StyleSheet, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { boardLayout } from "@/lib/moodboard/board-geometry";
import { MOODBOARD_BOARD_FRAME_SOURCE } from "@/lib/moodboard/folder-assets";
import { BoardItem } from "@/components/moodboard/board-item";
import type { MoodboardItem } from "@/lib/moodboard/types";

type Props = {
  width: number;
  items: MoodboardItem[];
  onItemChange: (id: string, patch: Partial<MoodboardItem>) => void;
  style?: ViewStyle;
};

export function MoodboardBoardCanvas({ width, items, onItemChange, style }: Props) {
  const layout = boardLayout(width);

  return (
    <View style={[styles.wrap, { width: layout.width, height: layout.height }, style]}>
      <Image
        source={MOODBOARD_BOARD_FRAME_SOURCE}
        style={StyleSheet.absoluteFillObject}
        contentFit="fill"
      />
      <View style={[styles.canvas, layout.canvasStyle]}>
        {items.map((item) => (
          <BoardItem
            key={item.id}
            item={item}
            canvasWidth={layout.canvasWidth}
            canvasHeight={layout.canvasHeight}
            onChange={(patch) => onItemChange(item.id, patch)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignSelf: "center",
    backgroundColor: "transparent",
    overflow: "visible",
  },
  canvas: { position: "absolute", overflow: "hidden" },
});
