import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useAudioPlayer } from "expo-audio";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { friendlyMediaName } from "@shared/media-label";

const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const CREAM_BG = "#FDF8F0";
const ACCENT = "#8B7355";

interface AudioPlayerProps {
  url: string;
  filename?: string;
  duration?: number; // seconds
}

// Generate pseudo-random waveform bars for visual effect
function generateWaveform(count: number, seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
    bars.push(0.2 + (hash % 80) / 100); // 0.2 to 1.0
  }
  return bars;
}

export function AudioPlayerCard({ url, filename, duration }: AudioPlayerProps) {
  const player = useAudioPlayer(url);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const WAVEFORM_BARS = 30;
  const waveform = useMemo(() => generateWaveform(WAVEFORM_BARS, url), [url]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      player.release();
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else {
      player.play();
      setIsPlaying(true);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      intervalRef.current = setInterval(() => {
        if (player.duration && player.duration > 0) {
          const cur = player.currentTime || 0;
          setCurrentTime(cur);
          setProgress(cur / player.duration);
          // Auto-stop at end
          if (cur >= player.duration - 0.5) {
            player.pause();
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }
      }, 250);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const displayDuration = duration || (player.duration ? player.duration : 0);
  const displayName = friendlyMediaName(filename, "audio") || "Аудио";
  const activeBarIndex = Math.floor(progress * WAVEFORM_BARS);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={togglePlay}
        style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.7 }, isPlaying && styles.playButtonActive]}
      >
        <MaterialIcons
          name={isPlaying ? "pause" : "play-arrow"}
          size={22}
          color={CREAM_BG}
        />
      </Pressable>

      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>
          {displayName}
        </Text>
        {/* Waveform visualization */}
        <View style={styles.waveformContainer}>
          {waveform.map((height, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: height * 20,
                  backgroundColor: i <= activeBarIndex ? ACCENT : "#D8D0C6",
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
          <Text style={styles.time}>{formatTime(displayDuration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CREAM_BG,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E8E0D8",
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  playButtonActive: {
    backgroundColor: "#6B5B4E",
  },
  info: {
    flex: 1,
  },
  filename: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN_DARK,
    marginBottom: 6,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 22,
    gap: 1.5,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 1,
    minWidth: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  time: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 11,
    color: BROWN_LIGHT,
  },
});
