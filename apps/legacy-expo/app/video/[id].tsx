// Архив Expo. Архивный экран предпочитает прямой videoUrl и иначе старый YouTube adapter; новый VK-каталог живёт в активном frontend.
import { createElement } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  Platform,
  Linking,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { displayVideoTitle } from "@/lib/video-title";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIDEO_HEIGHT = SCREEN_WIDTH * (9 / 16);

// Conditionally import expo-video (not available on web in all cases)
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  const expoVideo = require("expo-video");
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch (e) {
  // expo-video not available on web
}

export default function VideoDetailScreen() {
  // Архивный экран предпочитает прямой videoUrl и иначе старый YouTube adapter; новый VK-каталог живёт в активном frontend.

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: video, isLoading } = trpc.videos.getById.useQuery(
    { id: Number(id) },
    { enabled: !!id }
  );

  const handleBack = () => {
    // Возвращает пользователя к предыдущему экрану без изменения плеера на сервере.

    router.back();
  };

  if (isLoading || !video) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B7355" />
        </View>
        </ImageBackground>
  </ScreenContainer>
    );
  }

  const hasVideoFile = !!video.videoUrl;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      <ScrollView style={styles.container} bounces={false}>
        {/* Video player area */}
        <View style={styles.videoContainer}>
          {hasVideoFile && Platform.OS === "web" ? (
            createElement("video", {
              src: video.videoUrl,
              controls: true,
              playsInline: true,
              preload: "metadata",
              style: { width: "100%", height: "100%", backgroundColor: "#000", objectFit: "contain" },
            })
          ) : hasVideoFile && VideoView && useVideoPlayer ? (
            <VideoPlayerNative videoUrl={video.videoUrl!} />
          ) : (
            <YouTubeEmbed youtubeId={video.youtubeId} />
          )}
        </View>

        {/* Back button */}
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            { top: insets.top + 8 },
            pressed && { opacity: 0.6 },
          ]}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Video info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{displayVideoTitle(video.title, video.youtubeId)}</Text>

          {(video.views || video.publishedText) && (
            <Text style={styles.meta}>
              {video.views}{video.publishedText ? ` • ${video.publishedText}` : ""}
            </Text>
          )}

          <Text style={styles.qualityHint}>
            В приложении видео доступно к просмотру без VPN, но в более низком качестве. Для просмотра в высоком разрешении рекомендую перейти на YouTube
          </Text>

          {video.youtubeId ? (
            <Pressable
              onPress={() => void Linking.openURL(`https://www.youtube.com/watch?v=${video.youtubeId}`)}
              style={({ pressed }) => [styles.youtubeBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="play-circle-outline" size={20} color="#5C4033" />
              <Text style={styles.youtubeBtnText}>Смотреть на YouTube →</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      </ImageBackground>
  </ScreenContainer>
  );
}

// Native video player component (used when videoUrl is available on S3)
function VideoPlayerNative({ videoUrl }: { videoUrl: string }) {
  // Создаёт native player прямого файла с системными controls и без loop.

  if (!VideoView || !useVideoPlayer) return null;

  const player = useVideoPlayer(videoUrl, (p: any) => {
    p.loop = false;
  });

  return (
    <VideoView
      style={styles.videoPlayer}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: "#000000",
  },
  videoPlayer: {
    width: "100%",
    height: "100%",
  },
  thumbnailWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  playButton: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  backButton: {
    position: "absolute",
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    color: "#3C2A1A",
    lineHeight: 26,
    fontFamily: Platform.OS === "web" ? "EBGaramond-Bold, 'Times New Roman', serif" : "EBGaramond-Bold",
  },
  meta: {
    fontSize: 14,
    color: "#8B7355",
    marginTop: 8,
    fontFamily: "EBGaramond-Regular",
  },
  youtubeBtn: {
    marginTop: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 237, 224, 0.92)",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  youtubeBtnText: {
    fontSize: 14,
    color: "#5C4033",
    fontFamily: "EBGaramond-Regular",
    letterSpacing: 0.6,
  },
  qualityHint: {
    marginTop: 14,
    fontSize: 15,
    color: "#5C4033",
    lineHeight: 22,
    fontFamily: "EBGaramond-Regular",
  },
  actions: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F0E8",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8B7355",
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 20,
    padding: 12,
    backgroundColor: "#F5F0E8",
    borderRadius: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: "#8B7355",
    lineHeight: 18,
  },
});
