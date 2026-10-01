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
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useAudioPlayer(url);

  useEffect(() => {
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
