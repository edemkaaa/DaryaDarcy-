import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  ImageBackground,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { READABLE_ITALIC_FONT } from "@/lib/brand-font";
import { displayVideoTitle } from "@/lib/video-title";
import { VIDEO_FILM_DECOR_URL, VIDEO_ROSE_DECOR_URL } from "@/lib/tab-assets";
import { ScreenContainer } from "@/components/screen-container";
import { TabFocusGate } from "@/components/tab-focus-gate";
import { TabHeader } from "@/components/tab-header";
import { QueryRetryState } from "@/components/query-retry-state";
import { trpc } from "@/lib/trpc";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const CARD_H_PADDING = 20;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - CARD_H_PADDING * 2;
const THUMBNAIL_HEIGHT = CARD_WIDTH * (9 / 16);
const ROSE_W = 140;
const ROSE_H = 180;
const ROSE_TOP = 18;
const ROSE_INSET = -20;
const HEADER_MIN_HEIGHT = ROSE_TOP + ROSE_H - 16;

type Video = {
  id: number;
  youtubeId: string;
  title: string;
  duration: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  views: string | null;
  publishedText: string | null;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

function VideosBannerHeader() {
  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.headerSection}>
      <Image
        source={{ uri: VIDEO_FILM_DECOR_URL }}
        style={styles.filmDecor}
        contentFit="contain"
      />
      <Text style={styles.headerTitle}>ВИДЕО</Text>
      <Text style={styles.headerSubtitle}>мини-фильмы об уютной жизни</Text>
      <Image
        source={{ uri: VIDEO_ROSE_DECOR_URL }}
        style={styles.roseLeft}
        contentFit="contain"
      />
      <Image
        source={{ uri: VIDEO_ROSE_DECOR_URL }}
        style={styles.roseRight}
        contentFit="contain"
      />
    </Animated.View>
  );
}

function VideosScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: videos, isLoading, isError, refetch } = trpc.videos.list.useQuery(undefined, { retry: 1 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleVideoPress = useCallback((video: Video) => {
    router.push(`/video/${video.id}` as any);
  }, [router]);

  const renderVideoCard = useCallback(({ item }: { item: Video }) => {
    const stored = item.thumbnailUrl?.trim() ?? "";
    const thumbnailUrl =
      stored && !/ytimg\.com|img\.youtube\.com/i.test(stored)
        ? stored
        : `https://daryadarcy.com/media/yt-thumb/${item.youtubeId}/hqdefault.jpg`;

    return (
      <Pressable
        onPress={() => handleVideoPress(item)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
          {item.duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{item.duration}</Text>
            </View>
          ) : null}
          <View style={styles.playOverlay}>
            <MaterialIcons name="play-arrow" size={48} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
        <View style={styles.cardDescriptionContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {displayVideoTitle(item.title, item.youtubeId)}
          </Text>
          {item.views ? (
            <Text style={styles.meta}>
              {item.views}
              {item.publishedText ? ` • ${item.publishedText}` : ""}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }, [handleVideoPress]);

  if ((isLoading || isError) && !videos) {
    return (
      <ScreenContainer>
        <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
          <TabHeader transparent={false} />
          <QueryRetryState
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
            message="Не удалось загрузить видео"
            style={styles.loadingContainer}
          />
        </ImageBackground>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <TabHeader transparent={false} />
        <FlatList
          data={videos as Video[] | undefined}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderVideoCard}
          style={styles.list}
          ListHeaderComponent={<VideosBannerHeader />}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B7355" />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </ImageBackground>
    </ScreenContainer>
  );
}

export default function VideosScreen() {
  return (
    <TabFocusGate>
      <VideosScreenInner />
    </TabFocusGate>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingTop: 4,
    marginTop: -16,
  },
  list: {
    overflow: "visible",
  },
  headerSection: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 0,
    marginTop: -10,
    marginBottom: 0,
    minHeight: HEADER_MIN_HEIGHT,
    position: "relative",
    overflow: "visible",
    zIndex: 2,
  },
  filmDecor: {
    width: 130,
    height: 78,
    marginBottom: -10,
  },
  headerTitle: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 28,
    color: BROWN,
    letterSpacing: 8,
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: -6,
    zIndex: 3,
  },
  headerSubtitle: {
    fontFamily: READABLE_ITALIC_FONT,
    fontSize: 15.5,
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 0,
    zIndex: 3,
  },
  roseLeft: {
    position: "absolute",
    left: ROSE_INSET,
    top: ROSE_TOP,
    width: ROSE_W,
    height: ROSE_H,
    zIndex: 1,
    transform: [{ scaleX: -1 }],
  },
  roseRight: {
    position: "absolute",
    right: ROSE_INSET,
    top: ROSE_TOP,
    width: ROSE_W,
    height: ROSE_H,
    zIndex: 1,
  },
  card: {
    marginHorizontal: CARD_H_PADDING,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: CREAM,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbnailContainer: {
    width: "100%",
    height: THUMBNAIL_HEIGHT,
    position: "relative",
    overflow: "hidden",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
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
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  cardDescriptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CREAM,
  },
  title: {
    fontSize: 15,
    color: BROWN,
    lineHeight: 21,
    fontFamily: "EBGaramond-Regular",
  },
  meta: {
    fontSize: 13,
    color: BROWN_MUTED,
    marginTop: 6,
    fontFamily: "EBGaramond-Italic",
    lineHeight: 18,
  },
  separator: {
    height: 24,
    backgroundColor: "transparent",
  },
});
