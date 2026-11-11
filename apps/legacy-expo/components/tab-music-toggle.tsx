// Архив Expo. Управляет фоновым loop-плеером по жесту пользователя с заданной тихой громкостью.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

interface TabMusicToggleProps {
  url: string;
  iconColor?: string;
  volume?: number;
}

export function TabMusicToggle({ url, iconColor = "#FFFFFF", volume = 0.3 }: TabMusicToggleProps) {
  // Управляет фоновым loop-плеером по жесту пользователя с заданной тихой громкостью.

  const [isPlaying, setIsPlaying] = useState(false);
  const player = useAudioPlayer(url);

  useEffect(() => {
    // Настраивает silent-mode native, loop и громкость; при смене зависимости освобождает player.

    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true });
    }
    if (player) {
      player.loop = true;
      player.volume = volume;
    }
    return () => {
      if (player) player.release();
    };
  }, [player, volume]);

  const toggle = () => {
    // Переключает play/pause и локальный значок без обещания успешной сетевой загрузки.

    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        { opacity: pressed ? 0.7 : 1 },
        isPlaying && styles.buttonActive,
      ]}
    >
      <MaterialIcons
        name={isPlaying ? "music-note" : "music-off"}
        size={18}
        color={iconColor}
      />
    </Pressable>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(61, 46, 31, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 196, 168, 0.5)",
  },
  buttonActive: {
    backgroundColor: "#8B7355",
    borderColor: "#8B7355",
  },
});
