// Архив Expo. Показывает poster до native запуска либо HTML video на web с рамкой от заданного aspectRatio.
import { createElement, useCallback, useState } from "react";
import { View, Pressable, StyleSheet, Dimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

let VideoView: any = null;
let useVideoPlayer: any = null;
if (Platform.OS !== "web") {
  try {
    const expoVideo = require("expo-video");
    VideoView = expoVideo.VideoView;
    useVideoPlayer = expoVideo.useVideoPlayer;
  } catch {
    // expo-video not available
  }
}

interface VideoPlayerCardProps {
  videoUrl: string;
  thumbnailUrl: string;
  aspectRatio?: number;
}

export function VideoPlayerCard({ videoUrl, thumbnailUrl, aspectRatio = 4 / 5 }: VideoPlayerCardProps) {
  // Показывает poster до native запуска либо HTML video на web с рамкой от заданного aspectRatio.

  const [isPlaying, setIsPlaying] = useState(false);
  const height = SCREEN_WIDTH / aspectRatio;

  if (!videoUrl) {
    return (
      <View style={[cardStyles.container, { height }]}>
        <Image source={{ uri: thumbnailUrl }} style={cardStyles.thumbnail} contentFit="cover" transition={200} />
        <View style={cardStyles.playOverlay}>
          <View style={cardStyles.playButton}>
            <MaterialIcons name="play-arrow" size={40} color="#fff" />
          </View>
        </View>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[cardStyles.container, { height }]}>
        {createElement("video", {
          src: videoUrl,
          poster: thumbnailUrl || undefined,
          controls: true,
          playsInline: true,
          preload: "metadata",
          style: {
            width: "100%",
            height: "100%",
            backgroundColor: "#1a1a1a",
            objectFit: "cover",
          },
        })}
      </View>
    );
  }

  if (!isPlaying || !VideoView || !useVideoPlayer) {
    return (
      <Pressable style={[cardStyles.container, { height }]} onPress={() => setIsPlaying(true)}>
        <Image source={{ uri: thumbnailUrl }} style={cardStyles.thumbnail} contentFit="cover" transition={200} />
        <View style={cardStyles.playOverlay}>
          <View style={cardStyles.playButton}>
            <MaterialIcons name="play-arrow" size={40} color="#fff" />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <NativeVideoPlayer
      videoUrl={videoUrl}
      height={height}
      setIsPlaying={setIsPlaying}
    />
  );
}

function NativeVideoPlayer({
  videoUrl,
  height,
  setIsPlaying,
}: {
  videoUrl: string;
  height: number;
  setIsPlaying: (v: boolean) => void;
}) {
  // Создаёт native player с немедленным запуском и делегирует controls Expo VideoView.

  const player = useVideoPlayer(videoUrl, (p: any) => {
    p.loop = false;
    p.play();
  });

  const handlePause = useCallback(() => {
    // Останавливает native player и возвращает родительскую карточку к обложке.

    setIsPlaying(false);
    player.pause();
  }, [player, setIsPlaying]);

  return (
    <Pressable style={[cardStyles.container, { height }]} onPress={handlePause}>
      <VideoView
        style={cardStyles.video}
        player={player}
        allowsFullscreen
        nativeControls
        contentFit="cover"
      />
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    position: "relative",
    backgroundColor: "#1a1a1a",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
});
