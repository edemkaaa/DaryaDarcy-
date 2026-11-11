// Архив Expo. Показывает выдвижную доску тегов в рассчитанной льняной области исходного изображения.
import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { SEASON_TAGS, TOPIC_TAGS } from "@/lib/post-tags";

// ─── Constants ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH;
const PEEK_STRIP_WIDTH = 18; // visible edge strip when closed
// Banner height offset — drawer starts below the banner
const DRAWER_TOP_OFFSET = Math.round(SCREEN_HEIGHT * 0.23);
// Compact board — not full screen width
const BOARD_WIDTH_RATIO = 0.84;
const BOARD_WIDTH = Math.round(SCREEN_WIDTH * BOARD_WIDTH_RATIO);
const BOARD_LEFT = Math.round((SCREEN_WIDTH - BOARD_WIDTH) / 2);

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";

// Tag board image (user's own cork/linen board)
const TAG_BOARD_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c2a4341558e8-dZtWbRtaJLWFOYGX.webp";

const TOPIC_TAG_ROWS = [
  TOPIC_TAGS.slice(0, 5),
  TOPIC_TAGS.slice(5, 9),
  TOPIC_TAGS.slice(9, 13),
  TOPIC_TAGS.slice(13, 17),
  TOPIC_TAGS.slice(17, 21),
];

// Board asset is 2048×1536; with contentFit contain + top, rendered height = width × 0.75
const BOARD_IMG_ASPECT = 1536 / 2048;
const BOARD_HEIGHT = Math.round(BOARD_WIDTH * BOARD_IMG_ASPECT);

// Linen canvas inset inside the board image (fractions of rendered board size)
const LINEN_TOP_RATIO = 0.23;
const LINEN_BOTTOM_RATIO = 0.20;
const LINEN_SIDE_RATIO = 0.125;

const BOARD_LINEN_TOP = Math.round(BOARD_HEIGHT * LINEN_TOP_RATIO);
const BOARD_LINEN_SIDE = Math.round(BOARD_WIDTH * LINEN_SIDE_RATIO);
const BOARD_LINEN_HEIGHT = Math.round(
  BOARD_HEIGHT * (1 - LINEN_TOP_RATIO - LINEN_BOTTOM_RATIO),
);
// Push tag grid down on the linen (below the «ТЕГИ» paper strip)
const TAG_GRID_TOP_PADDING = Math.round(BOARD_LINEN_HEIGHT * 0.22);

// ─── Component ──────────────────────────────────────────────────────────────

interface TagBoardDrawerProps {
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export function TagBoardDrawer({ selectedTag, onSelectTag }: TagBoardDrawerProps) {
  // Показывает выдвижную доску тегов в рассчитанной льняной области исходного изображения.

  // translateX: 0 = fully open (drawer visible), DRAWER_WIDTH = fully closed (hidden off-screen right)
  const translateX = useSharedValue(DRAWER_WIDTH);
  const isOpenRef = useSharedValue(false);

  // Peek animation — subtle jiggle of the edge strip
  const peekAnim = useSharedValue(0);

  // Start peek animation loop (only when drawer is closed)
  useEffect(() => {
    // После монтирования запускает подсказку ручки; отдельная отмена бесконечной анимации в архиве отсутствует.

    startPeekAnimation();
  }, []);

  const startPeekAnimation = useCallback(() => {
    // Запускает периодический короткий сдвиг ручки закрытой панели.

    peekAnim.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 180, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 250, easing: Easing.inOut(Easing.ease) }),
          withDelay(4500, withTiming(0, { duration: 0 }))
        ),
        -1,
        false
      )
    );
  }, []);

  const stopPeekAnimation = useCallback(() => {
    // Плавно возвращает ручку к нулевому смещению перед открытием.

    peekAnim.value = withTiming(0, { duration: 100 });
  }, []);

  const openDrawer = useCallback(() => {
    // Выдвигает панель, останавливает подсказку и даёт native haptic.

    isOpenRef.value = true;
    translateX.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    stopPeekAnimation();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    // Уводит панель за экран и откладывает повторную подсказку ручки; timeout исторически не хранится для cleanup.

    isOpenRef.value = false;
    translateX.value = withTiming(DRAWER_WIDTH, { duration: 280, easing: Easing.in(Easing.cubic) });
    // Restart peek after closing
    setTimeout(() => {
      startPeekAnimation();
    }, 1500);
  }, []);

  // Animated styles
  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const peekStyle = useAnimatedStyle(() => {
    const drawerClosed = translateX.value >= DRAWER_WIDTH - 1;
    return {
      transform: [{ translateX: drawerClosed ? peekAnim.value : 0 }],
      opacity: interpolate(translateX.value, [DRAWER_WIDTH * 0.5, DRAWER_WIDTH], [0, 1], Extrapolation.CLAMP),
    };
  });

  const handleTagPress = (tag: string) => {
    // Переключает выбранный фильтр, повторный выбор снимает его.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (selectedTag === tag) {
      onSelectTag(null); // deselect
    } else {
      onSelectTag(tag);
    }
  };

  return (
    <>
      {/* Peek strip — visible edge that jiggles, tap to open */}
      <Animated.View style={[styles.peekStrip, peekStyle]}>
        <Pressable
          onPress={openDrawer}
          style={({ pressed }) => [
            styles.peekTouchable,
            pressed && { opacity: 0.6 },
          ]}
        >
          <View style={styles.peekHandle}>
            <View style={styles.peekLine} />
            <View style={[styles.peekLine, { marginTop: 3 }]} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Main Drawer */}
      <Animated.View style={[styles.drawer, drawerStyle]}>
        <View style={styles.boardFrame}>
          <Image
            source={{ uri: TAG_BOARD_URI }}
            style={styles.boardImage}
            contentFit="contain"
            contentPosition="top"
          />

          {/* Close button — top right of board */}
          <Pressable
            onPress={closeDrawer}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.5, transform: [{ scale: 0.9 }] },
            ]}
          >
            <MaterialIcons name="close" size={20} color={BROWN} />
          </Pressable>

          {/* Content on top of board */}
          <View style={styles.drawerContent}>
            <View style={styles.tagBoardInner}>
          {/* Season tags */}
          <View style={styles.tagSection}>
            <View style={styles.tagRow}>
              {SEASON_TAGS.map((tag) => (
                <Pressable
                  key={tag.slug}
                  style={({ pressed }) => [
                    styles.tagChip,
                    styles.seasonChip,
                    selectedTag === tag.slug && styles.tagChipActive,
                    pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                  ]}
                  onPress={() => handleTagPress(tag.slug)}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      styles.seasonChipText,
                      selectedTag === tag.slug && styles.tagChipTextActive,
                    ]}
                  >
                    {tag.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Category tags — fixed rows aligned to the board */}
          <View style={styles.tagSection}>
            {TOPIC_TAG_ROWS.map((row, rowIndex) => (
              <View key={`topic-row-${rowIndex}`} style={styles.tagRow}>
                {row.map((tag) => (
                  <Pressable
                    key={tag.slug}
                    style={({ pressed }) => [
                      styles.tagChip,
                      styles.categoryChip,
                      selectedTag === tag.slug && styles.tagChipActive,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                    ]}
                    onPress={() => handleTagPress(tag.slug)}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        styles.categoryChipText,
                        selectedTag === tag.slug && styles.tagChipTextActive,
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* Clear filter button */}
          {selectedTag && (
            <Pressable
              style={({ pressed }) => [
                styles.clearButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                onSelectTag(null);
                closeDrawer();
              }}
            >
              <Text style={styles.clearButtonText}>Сбросить фильтр ×</Text>
            </Pressable>
          )}
          </View>
        </View>
        </View>
      </Animated.View>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

// Область тегов вычислена по долевым inset льняного участка доски; скрытая панель уходит вправо, остаётся только ручка.
const styles = StyleSheet.create({
  peekStrip: {
    position: "absolute",
    right: 0,
    top: DRAWER_TOP_OFFSET + 60,
    width: PEEK_STRIP_WIDTH,
    height: 70,
    zIndex: 95,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: "rgba(92, 64, 51, 0.65)",
  },
  peekTouchable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  peekHandle: {
    alignItems: "center",
    justifyContent: "center",
  },
  peekLine: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: "rgba(253, 248, 240, 0.75)",
  },
  drawer: {
    position: "absolute",
    right: 0,
    top: DRAWER_TOP_OFFSET,
    bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 100,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  boardFrame: {
    position: "absolute",
    top: 4,
    left: BOARD_LEFT,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    overflow: "hidden",
  },
  boardImage: {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 110,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(253, 248, 240, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  drawerContent: {
    position: "absolute",
    top: BOARD_LINEN_TOP,
    left: BOARD_LINEN_SIDE,
    right: BOARD_LINEN_SIDE,
    height: BOARD_LINEN_HEIGHT,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: TAG_GRID_TOP_PADDING,
  },
  tagBoardInner: {
    width: "100%",
    alignItems: "center",
  },
  tagSection: {
    marginBottom: 1,
    alignItems: "center",
    width: "100%",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "center",
    gap: 2,
    marginBottom: 1,
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    shadowColor: "#5C4033",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  seasonChip: {
    backgroundColor: "rgba(232, 210, 180, 0.92)",
    borderColor: "rgba(180, 150, 110, 0.4)",
  },
  categoryChip: {
    backgroundColor: "rgba(245, 238, 228, 0.92)",
    borderColor: "rgba(160, 140, 120, 0.3)",
  },
  tagChipActive: {
    backgroundColor: "rgba(92, 64, 51, 0.85)",
    borderColor: "rgba(92, 64, 51, 0.9)",
  },
  tagChipText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 11,
    letterSpacing: 0.05,
  },
  seasonChipText: {
    color: "#6B4E37",
  },
  categoryChipText: {
    color: BROWN_MUTED,
  },
  tagChipTextActive: {
    color: CREAM,
  },
  clearButton: {
    alignSelf: "center",
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(92, 64, 51, 0.1)",
  },
  clearButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN,
    letterSpacing: 0.5,
  },
});
