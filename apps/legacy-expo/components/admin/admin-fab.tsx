// Архив Expo. Показывает UI создания только owner; настоящая проверка роли остаётся в серверных процедурах.
import { useState } from "react";
import { Pressable, StyleSheet, Platform, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "expo-router";
import { CreatePostModal } from "./create-post-modal";

const ACCENT = "#8B7355";
const CREAM_BG = "#FDF8F0";

type Target = "feed" | "club" | "both";

interface AdminFABProps {
  target: Target;
}

/**
 * Floating Action Button for admin post creation.
 * Shows only for the app owner. Tap to create a post; settings opens the admin panel.
 */
export function AdminFAB({ target }: AdminFABProps) {
  // Показывает UI создания только owner; настоящая проверка роли остаётся в серверных процедурах.

  const { isOwner } = useAuth();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  if (!isOwner) return null;

  const handlePress = () => {
    // Даёт native haptic и открывает форму поста с текущей целью.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowCreate(true);
  };

  const openAdmin = () => {
    // Открывает общую админку после native haptic без изменения контента.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    router.push("/admin");
  };

  return (
    <>
      <View style={styles.stack} pointerEvents="box-none">
        <Pressable
          onPress={openAdmin}
          accessibilityLabel="Открыть админку"
          style={({ pressed }) => [styles.fab, styles.fabSecondary, pressed && styles.fabPressed]}
        >
          <MaterialIcons name="settings" size={22} color={ACCENT} />
        </Pressable>
        <Pressable
          onPress={handlePress}
          onLongPress={openAdmin}
          delayLongPress={500}
          accessibilityLabel="Новый пост"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <MaterialIcons name="add" size={28} color={CREAM_BG} />
        </Pressable>
      </View>

      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        defaultTarget={target}
      />
    </>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    bottom: 90,
    right: 20,
    alignItems: "center",
    gap: 10,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabSecondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CREAM_BG,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
});
