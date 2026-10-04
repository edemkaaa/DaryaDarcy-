import React, { createElement, useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Modal, Platform, Image as RNImage } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { friendlyMediaName } from "@shared/media-label";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const FRAME_WIDTH = SCREEN_WIDTH - 32;
const LANDSCAPE_HEIGHT = FRAME_WIDTH * (9 / 16);
const REEL_HEIGHT = Math.min(FRAME_WIDTH * (16 / 9), SCREEN_HEIGHT * 0.62);

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

interface VideoPreviewProps {
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  duration?: number;
  topAligned?: boolean;
}

export function VideoPreviewCard({ url, thumbnailUrl, filename, duration, topAligned }: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const label = friendlyMediaName(filename, "video");
  const isReel = /\/reels\//i.test(url);

  useEffect(() => {
    if (!thumbnailUrl) return;
    let cancelled = false;
    RNImage.getSize(
      thumbnailUrl,
      (width, height) => {
        if (!cancelled && width && height) setIsPortrait(height > width * 1.05);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [thumbnailUrl]);

  const frameHeight = isReel || isPortrait
    ? Math.min(FRAME_WIDTH * (16 / 9), SCREEN_HEIGHT * 0.62)
    : LANDSCAPE_HEIGHT;
  const fitMode = isPortrait ? "contain" : "cover";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { height: frameHeight }, topAligned && styles.topAligned, isPortrait && styles.portraitFrame]}>
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

  if (!VideoView || !useVideoPlayer) {
    return (
      <View style={[styles.container, { height: frameHeight }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderThumb]}>
            <MaterialIcons name="videocam" size={40} color="#B8A99A" />
          </View>
        )}
      </View>
    );
  }

  return (
    <NativeClubVideo
      url={url}
      thumbnailUrl={thumbnailUrl}
      frameHeight={frameHeight}
      durationLabel={duration ? formatTime(duration) : null}
      caption={label}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      showFullscreen={showFullscreen}
      setShowFullscreen={setShowFullscreen}
      topAligned={topAligned}
      isPortrait={isPortrait}
      fitMode={fitMode}
    />
  );
}

function NativeClubVideo({
  url,
  thumbnailUrl,
  frameHeight,
  durationLabel,
  caption,
  isPlaying,
  setIsPlaying,
  showFullscreen,
  setShowFullscreen,
  topAligned,
  isPortrait,
  fitMode,
}: {
  url: string;
  thumbnailUrl?: string;
  frameHeight: number;
  durationLabel: string | null;
  caption: string | null;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  showFullscreen: boolean;
  setShowFullscreen: (v: boolean) => void;
  topAligned?: boolean;
  isPortrait?: boolean;
  fitMode?: "contain" | "cover";
}) {
  const player = useVideoPlayer(url, (p: any) => {
    p.loop = false;
  });

  const handlePlay = useCallback(() => {
    player.play();
    setIsPlaying(true);
  }, [player, setIsPlaying]);

  const handlePause = useCallback(() => {
    player.pause();
    setIsPlaying(false);
  }, [player, setIsPlaying]);

  if (isPlaying) {
    return (
      <>
        <View style={[styles.container, { height: frameHeight }, topAligned && styles.topAligned, isPortrait && styles.portraitFrame]}>
          <VideoView
            player={player}
            style={styles.inlinePlayer}
            contentFit={fitMode || "cover"}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            nativeControls={false}
          />
          <View style={styles.inlineControls}>
            <Pressable onPress={handlePause} style={({ pressed }) => [styles.inlineBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="pause" size={22} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => setShowFullscreen(true)} style={({ pressed }) => [styles.inlineBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="fullscreen" size={22} color="#FFF" />
            </Pressable>
          </View>
        </View>
        <Modal visible={showFullscreen} animationType="fade" supportedOrientations={["portrait", "landscape"]}>
          <View style={styles.modalContainer}>
            <VideoView player={player} style={styles.videoPlayer} allowsFullscreen allowsPictureInPicture />
            <Pressable
              onPress={() => setShowFullscreen(false)}
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="close" size={28} color="#FFF" />
            </Pressable>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <Pressable
      onPress={handlePlay}
      style={({ pressed }) => [
        styles.container,
        { height: frameHeight },
        topAligned && styles.topAligned,
        isPortrait && styles.portraitFrame,
        pressed && { opacity: 0.9 },
      ]}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} contentFit="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.placeholderThumb]}>
          <MaterialIcons name="videocam" size={40} color="#B8A99A" />
        </View>
      )}
      <View style={styles.overlay}>
        <View style={styles.playCircle}>
          <MaterialIcons name="play-arrow" size={32} color="#FFF" />
        </View>
      </View>
      {durationLabel ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      ) : null}
      {caption ? (
        <View style={styles.filenameBadge}>
          <Text style={styles.filenameText} numberOfLines={1}>{caption}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
    backgroundColor: "#2A2A2A",
  },
  topAligned: {
    marginTop: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  portraitFrame: {
    backgroundColor: "#EDE6DA",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  placeholderThumb: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8E0D8",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
  },
  filenameBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: "60%",
  },
  filenameText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "EBGaramond-Regular",
  },
  inlinePlayer: {
    width: "100%",
    height: "100%",
  },
  inlineControls: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    gap: 8,
  },
  inlineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  videoPlayer: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
