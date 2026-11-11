// Архив Expo. Архивный главный экран локальных досок показывает последнюю осеннюю доску и доступные папки.
import { useCallback, useState } from "react";
import {
  Alert,
  Dimensions,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { MoodboardBoardCanvas } from "@/components/moodboard/moodboard-board-canvas";
import { MoodboardEditor } from "@/components/moodboard/moodboard-editor";
import { SeasonFolderRow } from "@/components/moodboard/season-folder-row";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useClub } from "@/lib/club-context";
import {
  MOODBOARD_BROWN_DARK,
  MOODBOARD_CREAM,
  MOODBOARD_FREE_LIMIT,
  PAPER_TEXTURE_URI,
  SEASON_META,
} from "@/lib/moodboard/constants";
import { canCreateMoodboard, findLatestBoardForSeason, getMoodboard } from "@/lib/moodboard/storage";
import type { MoodboardDoc, MoodboardSeason } from "@/lib/moodboard/types";

const { width: SCREEN_W } = Dimensions.get("window");
const BOARD_W = Math.min(SCREEN_W - 32, 448);
const DEFAULT_SEASON: MoodboardSeason = "autumn";

export default function MoodboardHomeScreen() {
  // Архивный главный экран локальных досок показывает последнюю осеннюю доску и доступные папки.

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSubscribed } = useClub();
  const { boardId: boardIdParam } = useLocalSearchParams<{ boardId?: string }>();
  const boardId = Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam;

  const [board, setBoard] = useState<MoodboardDoc | null>(null);

  const refresh = useCallback(async () => {
    // Перечитывает boardId или последнюю доску сезона при возвращении на экран.

    if (boardId) {
      const byId = await getMoodboard(boardId);
      if (byId) {
        setBoard(byId);
        return;
      }
    }
    const latest = await findLatestBoardForSeason(DEFAULT_SEASON);
    setBoard(latest);
  }, [boardId, isSubscribed]);

  useFocusEffect(
    useCallback(() => {
    // При фокусе перечитывает локальную доску, чтобы изменения редактора отобразились на главной.

      void refresh();
    }, [refresh]),
  );

  /** ТЗ: тап на папку → сетка выбора (всегда). */
  const openSeason = (season: MoodboardSeason) => {
    // Проверяет локальный лимит создания и открывает picker доступного сезона.

    const meta = SEASON_META[season];
    if (!meta.enabled) {
      Alert.alert("Скоро", `${meta.label} откроется позже.`);
      return;
    }
    void (async () => {
      const existing = await findLatestBoardForSeason(season);
      if (!existing && !(await canCreateMoodboard(isSubscribed))) {
        Alert.alert(
          "Лимит мудбордов",
          `Бесплатно доступно ${MOODBOARD_FREE_LIMIT} мудборда. Участницам клуба — безлимит.`,
        );
        return;
      }
      const q = existing ? `?boardId=${existing.id}` : "";
      router.push(`/moodboard/${season}/pick${q}` as any);
    })();
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} style={{ flex: 1 }} resizeMode="cover">
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={22} color={MOODBOARD_BROWN_DARK} />
            </Pressable>
            <View style={{ width: 22 }} />
          </View>

          <Text style={styles.title}>МУДБОРД</Text>

          <View style={styles.foldersBlock}>
            <SeasonFolderRow activeSeason={DEFAULT_SEASON} onPressSeason={openSeason} folderSize={84} />
          </View>

          {board ? (
            <MoodboardEditor board={board} onChange={setBoard} />
          ) : (
            <View style={styles.emptyBoard}>
              <MoodboardBoardCanvas width={BOARD_W} items={[]} onItemChange={() => {}} />
              <Text style={styles.emptyHint}>Нажмите «Осень», чтобы выбрать фото</Text>
            </View>
          )}
        </ScrollView>
      </ImageBackground>
    </ScreenContainer>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 26,
    fontWeight: "400",
    color: MOODBOARD_BROWN_DARK,
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 8,
  },
  foldersBlock: {
    marginTop: 10,
    marginBottom: 8,
    width: "100%",
  },
  scroll: {
    paddingHorizontal: 16,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
  emptyBoard: {
    width: "100%",
    alignItems: "center",
    marginTop: 12,
  },
  emptyHint: {
    marginTop: 12,
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: "#8B7355",
    textAlign: "center",
  },
});
