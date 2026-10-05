import { useCallback, useRef } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { MoodboardBoardCanvas } from "@/components/moodboard/moodboard-board-canvas";
import { MoodboardRibbon } from "@/components/moodboard/moodboard-ribbon";
import { MOODBOARD_BROWN_DARK } from "@/lib/moodboard/constants";
import { saveAndShareMoodboard } from "@/lib/moodboard/export";
import { saveMoodboard } from "@/lib/moodboard/storage";
import type { MoodboardDoc, MoodboardItem } from "@/lib/moodboard/types";

const { width: SCREEN_W } = Dimensions.get("window");
const BOARD_W = Math.min(SCREEN_W - 32, 448);

type Props = {
  board: MoodboardDoc;
  onChange: (board: MoodboardDoc) => void;
};

export function MoodboardEditor({ board, onChange }: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const persist = useCallback(
    (next: MoodboardDoc) => {
      onChange(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveMoodboard(next);
      }, 400);
    },
    [onChange],
  );

  const updateItem = (id: string, patch: Partial<MoodboardItem>) => {
    persist({
      ...board,
      items: board.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  };

  const handleSave = async () => {
    if (board.items.length === 0 || savingRef.current) return;
    savingRef.current = true;
    try {
      await saveMoodboard(board);
      await saveAndShareMoodboard(board);
    } catch (e) {
      Alert.alert("Не удалось сохранить", e instanceof Error ? e.message : "Попробуйте снова");
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        value={board.title}
        onChangeText={(title) => persist({ ...board, title })}
        placeholder="Название мудборда"
        placeholderTextColor="#A0845C"
        style={styles.titleInput}
      />

      <MoodboardBoardCanvas
        width={BOARD_W}
        items={board.items}
        onItemChange={updateItem}
        style={styles.board}
      />

      <View style={styles.footer}>
        <MoodboardRibbon
          items={board.items}
          onReorder={(items) => persist({ ...board, items })}
          onRemove={(id) => persist({ ...board, items: board.items.filter((it) => it.id !== id) })}
        />
        <View style={styles.saveRow}>
          <Pressable
            onPress={() => void handleSave()}
            disabled={board.items.length === 0}
            style={({ pressed }) => [
              styles.saveBtn,
              board.items.length === 0 && styles.saveBtnDisabled,
              pressed && board.items.length > 0 && { opacity: 0.85 },
            ]}
          >
            <MaterialIcons name="ios-share" size={26} color={MOODBOARD_BROWN_DARK} />
            <Text style={styles.saveLabel}>сохранить</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center", marginTop: 28 },
  titleInput: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 18,
    fontWeight: "400",
    color: MOODBOARD_BROWN_DARK,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 14,
    width: "100%",
  },
  board: { marginBottom: 0 },
  footer: { width: "100%" },
  saveRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 12,
    paddingRight: 4,
    minHeight: 56,
  },
  saveBtn: { alignItems: "center", gap: 4 },
  saveBtnDisabled: { opacity: 0.45 },
  saveLabel: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: MOODBOARD_BROWN_DARK,
    textTransform: "lowercase",
  },
});
