// Архив Expo. Создаёт локальный элемент фото с базовым размещением в очередном слоте.
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MoodboardPickerFooter,
  MoodboardPickerGrid,
} from "@/components/moodboard/moodboard-picker-grid";
import { catalogForSeason } from "@/lib/moodboard/autumn-catalog";
import {
  MOODBOARD_BROWN_DARK,
  MOODBOARD_CREAM,
  PAPER_TEXTURE_URI,
  SEASON_META,
} from "@/lib/moodboard/constants";
import {
  createMoodboard,
  findLatestBoardForSeason,
  getMoodboard,
  saveMoodboard,
} from "@/lib/moodboard/storage";
import { defaultItemPlacement } from "@/lib/moodboard/board-geometry";
import type { MoodboardItem, MoodboardSeason } from "@/lib/moodboard/types";
import { useClub } from "@/lib/club-context";

function newItem(uri: string, slotIndex: number): MoodboardItem {
  // Создаёт локальный элемент фото с базовым размещением в очередном слоте.

  return { id: `${Date.now()}-${slotIndex}`, uri, ...defaultItemPlacement(slotIndex) };
}

export default function MoodboardPickScreen() {
  // Выключенный picker восстанавливает локальную доску, ограничивает бесплатное создание и добавляет выбранные фото.

  const { season: seasonParam, boardId: boardIdParam } = useLocalSearchParams<{
    season: string;
    boardId?: string;
  }>();
  const season = (Array.isArray(seasonParam) ? seasonParam[0] : seasonParam) as MoodboardSeason;
  const boardId = Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSubscribed } = useClub();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [targetBoardId, setTargetBoardId] = useState<string | null>(boardId ?? null);

  const meta = SEASON_META[season];
  const catalog = useMemo(() => /* Мемоизирует каталог текущего сезона без сетевого запроса. */ catalogForSeason(season), [season]);

  useEffect(() => {
    // Проверяет доступность сезона и выбирает существующую либо новую доску; исторический async не имеет отмены по unmount.

    void (async () => {
      if (!meta?.enabled) {
        router.replace("/moodboard" as any);
        return;
      }
      if (boardId) {
        const board = await getMoodboard(boardId);
        if (board) {
          setTargetBoardId(board.id);
          setReady(true);
          return;
        }
      }
      const latest = await findLatestBoardForSeason(season);
      if (latest) {
        setTargetBoardId(latest.id);
        setReady(true);
        return;
      }
      const created = await createMoodboard(season, isSubscribed);
      if (created === "limit") {
        Alert.alert(
          "Лимит мудбордов",
          "Бесплатно доступно 3 мудборда. Оформите клуб для безлимита.",
        );
        router.back();
        return;
      }
      setTargetBoardId(created.id);
      setReady(true);
    })();
  }, [boardId, isSubscribed, meta?.enabled, router, season]);

  const toggle = (id: string) => {
    // Переключает id выбранного фото через новый Set, сохраняя React-обновление.

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    // Перечитывает доску, добавляет выбранные снимки с геометрией и сохраняет локальный список до навигации.

    if (!targetBoardId) return;
    const board = await getMoodboard(targetBoardId);
    if (!board) return;
    const picked = catalog.filter((i) => selected.has(i.id));
    if (picked.length === 0) return;
    const added = picked.map((img, i) => ({
      ...newItem(img.uri, board.items.length + i),
      cutout: img.cutout ?? /\.png(\?|$)/i.test(img.uri),
    }));
    await saveMoodboard({ ...board, items: [...board.items, ...added] });
    router.replace(`/moodboard?boardId=${targetBoardId}` as any);
  };

  if (!ready) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Загрузка…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color={MOODBOARD_BROWN_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Мудборд · {meta.label.toLowerCase()}</Text>
        <View style={{ width: 22 }} />
      </View>
      <MoodboardPickerGrid images={catalog} selected={selected} onToggle={toggle} />
      <MoodboardPickerFooter selectedCount={selected.size} onAdd={() => void handleAdd()} />
    </View>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MOODBOARD_CREAM },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontFamily: "EBGaramond-Regular", fontSize: 16, color: MOODBOARD_BROWN_DARK },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 20,
    color: MOODBOARD_BROWN_DARK,
  },
});
