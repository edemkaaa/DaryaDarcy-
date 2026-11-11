// Архив Expo. Размещает home/profile и необязательную музыку поверх баннера либо в обычном потоке с SafeArea.
import { View, Pressable, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabMusicToggle } from "@/components/tab-music-toggle";

/**
 * Compact custom header with home (left) and profile (right) icons.
 * Used on all tab screens since native headers are disabled.
 *
 * Props:
 * - transparent: if true, renders absolutely positioned with white icons (for overlay on banners)
 *   If false, renders as a static element with brown icons and a subtle cream background.
 *   Default is true.
 * - musicUrl: when set, shows a small music toggle next to the profile icon.
 */
interface TabHeaderProps {
  transparent?: boolean;
  musicUrl?: string;
}

export function TabHeader({ transparent = true, musicUrl }: TabHeaderProps) {
  // Размещает home/profile и необязательную музыку поверх баннера либо в обычном потоке с SafeArea.

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const iconColor = transparent ? "#FFFFFF" : "#5C4033";

  return (
    <View
      style={[
        transparent ? styles.containerAbsolute : styles.containerStatic,
        { paddingTop: insets.top + 4 },
      ]}
    >
      <Pressable
        onPress={() => router.navigate("/(tabs)" as any)}
        style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
      >
        <MaterialIcons name="home" size={22} color={iconColor} />
      </Pressable>
      <View style={styles.rightGroup}>
        {musicUrl ? <TabMusicToggle url={musicUrl} iconColor={iconColor} /> : null}
        <Pressable
          onPress={() => router.push("/(tabs)/profile" as any)}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
        >
          <MaterialIcons name="person-outline" size={22} color={iconColor} />
        </Pressable>
      </View>
    </View>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  containerAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  containerStatic: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
