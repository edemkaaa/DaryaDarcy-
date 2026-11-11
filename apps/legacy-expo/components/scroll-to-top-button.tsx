// Архив Expo. Показывает плавающий переход наверх с коротким fade и native haptic, не управляя самим scroll.
import { Pressable, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const ACCENT = "#8B7355";
const CREAM_BG = "#FDF8F0";

interface ScrollToTopButtonProps {
  visible: boolean;
  onPress: () => void;
  /** Distance from bottom edge (above tab bars / FAB stacks). */
  bottom?: number;
}

export function ScrollToTopButton({ visible, onPress, bottom = 90 }: ScrollToTopButtonProps) {
  // Показывает плавающий переход наверх с коротким fade и native haptic, не управляя самим scroll.

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={[styles.wrap, { bottom }]}>
      <Pressable
        accessibilityLabel="Наверх"
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress();
        }}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <MaterialIcons name="keyboard-arrow-up" size={28} color={CREAM_BG} />
      </Pressable>
    </Animated.View>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 20,
    zIndex: 99,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
});
