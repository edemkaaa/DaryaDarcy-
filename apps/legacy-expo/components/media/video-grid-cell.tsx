import React, { createElement, useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Platform, Image as RNImage } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { FALLBACK_PHOTO_RATIO, useMediaAspectRatio } from "@/lib/photo-aspect-ratios";

let VideoView: any = null;
let useVideoPlayer: any = null;
if (Platform.OS !== "web") {
  try {
    const expoVideo = require("expo-video");
    VideoView = expoVideo.VideoView;
    useVideoPlayer = expoVideo.useVideoPlayer;
  } catch {
    // native player unavailable
  }
}

interface VideoGridCellProps {
  url: string;
  thumbnailUrl?: string;
  onPress?: () => void;
  standalone?: boolean;
}

export function VideoGridCell({ url, thumbnailUrl, onPress, standalone }: VideoGridCellProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const aspectRatio = useMediaAspectRatio(thumbnailUrl, FALLBACK_PHOTO_RATIO);
  const isPortrait = aspectRatio < 0.95;
  const fitMode = isPortrait ? "contain" : "cover";

  if (Platform.OS === "web" && isPlaying) {
    return (
      <View style={[styles.cell, { aspectRatio }, standalone && styles.standalone, isPortrait && styles.portraitBg]}>
        {createElement("video", {
          src: url,
          poster: thumbnailUrl || undefined,
          controls: true,
          playsInline: true,
          preload: "metadata",
          style: {
            width: "100%",
            height: "100%",
            backgroundColor: isPortrait ? "#EDE6DA" : "#1a1a1a",
            objectFit: fitMode,
          },
        })}
      </View>
    );
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    setIsPlaying(true);
  };

  if (Platform.OS !== "web" && isPlaying && VideoView && useVideoPlayer) {
    return (
      <NativePlayingCell
        url={url}
        fitMode={fitMode}
        isPortrait={isPortrait}
        standalone={standalone}
        aspectRatio={aspectRatio}
      />
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.cell,
        { aspectRatio },
        standalone && styles.standalone,
        isPortrait && styles.portraitBg,
        pressed && { opacity: 0.92 },
      ]}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.placeholder]}>
          <MaterialIcons name="videocam" size={28} color="#B8A99A" />
        </View>
      )}
      <View style={styles.overlay}>
        <View style={styles.playCircle}>
          <MaterialIcons name="play-arrow" size={24} color="#FFF" />
        </View>
      </View>
    </Pressable>
  );
}

function NativePlayingCell({
  url,
  fitMode,
  isPortrait,
  standalone,
  aspectRatio,
}: {
  url: string;
  fitMode: "contain" | "cover";
  isPortrait: boolean;
  standalone?: boolean;
  aspectRatio: number;
}) {
  const player = useVideoPlayer(url, (p: any) => {
    p.loop = false;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <View style={[styles.cell, { aspectRatio }, standalone && styles.standalone, isPortrait && styles.portraitBg]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit={fitMode}
        allowsFullscreen
        allowsPictureInPicture={false}
        nativeControls
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#2A2A2A",
  },
  standalone: {
    flex: undefined,
    width: "100%",
  },
  portraitBg: {
    backgroundColor: "#EDE6DA",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8E0D8",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
