import { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import * as Haptics from "expo-haptics";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import { resolvePostVideo } from "@/lib/resolve-post-video";
import { PostMediaSection } from "@/components/media/post-media-section";
import { NaturalPhotoStack } from "@/components/media/natural-photo-stack";
import { useClubContentProtection } from "@/hooks/use-club-protection";
import { postTagLabel } from "@/lib/post-tags";
import { postDisplayDate } from "@/lib/post-date";
import { pressableProps } from "@/lib/ios-web-press";
import { ScreenErrorBoundary } from "@/components/screen-error-boundary";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const GREEN_ACCENT = "#8B7355" // Brown accent (was green);

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function PostDetailScreenInner() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likedOnServer, setLikedOnServer] = useState(false);

  const postId = parseInt(id || "0", 10);
  const utils = trpc.useUtils();
  const likeMut = trpc.feed.toggleLike.useMutation();
  const saveMut = trpc.feed.toggleSave.useMutation({
    onSuccess: () => {
      void utils.feed.savedPosts.invalidate();
      void utils.feed.userInteractions.invalidate();
    },
  });
  const interactions = trpc.feed.userInteractions.useQuery(undefined, { enabled: Boolean(user) && postId > 0 });

  useEffect(() => {
    if (!interactions.data || !postId) return;
    const liked = interactions.data.likedIds.includes(postId);
    const saved = interactions.data.savedIds.includes(postId);
    setIsLiked(liked);
    setLikedOnServer(liked);
    setIsSaved(saved);
  }, [interactions.data, postId]);

  const { data: post, isLoading } = trpc.feed.getById.useQuery(
    { id: postId },
    { enabled: postId > 0, retry: 1 }
  );
  useClubContentProtection(Boolean(post && (post.target === "club" || post.target === "both")));

  const handleLike = () => {
    if (!user) {
      router.push("/login?next=/feed" as any);
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsLiked((prev) => !prev);
    likeMut.mutate({ postId });
  };

  const handleSave = () => {
    if (!user) {
      router.push("/login?next=/feed" as any);
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsSaved((prev) => !prev);
    saveMut.mutate({ postId });
  };

  const onPhotoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentPhotoIndex(index);
  };

  if (isLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable
            {...pressableProps(() => router.back())}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <MaterialIcons name="arrow-back" size={22} color={BROWN_DARK} />
          </Pressable>
          <Text style={styles.headerTitle}>Пост</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
        </ImageBackground>
  </ScreenContainer>
    );
  }

  if (!post) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <MaterialIcons name="arrow-back" size={22} color={BROWN_DARK} />
          </Pressable>
          <Text style={styles.headerTitle}>Пост</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Пост не найден</Text>
        </View>
        </ImageBackground>
  </ScreenContainer>
    );
  }

  const photos = (post.photos as string[]) || [];
  const tags = (post.tags as string[]) || [];
  const media = ((post as { media?: { id: number; type: "video" | "audio" | "document"; url: string; filename?: string | null; mimeType?: string | null; fileSize?: number | null; duration?: number | null }[] }).media) || [];
  const resolved = resolvePostVideo(photos, media);
  const viewPhotos = resolved.stackPhotos;
  const hasVideo = resolved.hasVideo;
  const isClubPost = post.target === "club" || post.target === "both";
  const tagLabels = tags.map((slug) => postTagLabel(slug)).filter(Boolean);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          {...pressableProps(() => router.back())}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialIcons name="arrow-back" size={22} color={BROWN_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Пост</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {(hasVideo || viewPhotos.length > 0) && (
          <View style={styles.photoSection}>
            <NaturalPhotoStack
              photos={viewPhotos}
              video={hasVideo && resolved.videoUrl ? { url: resolved.videoUrl } : undefined}
              posterUrl={resolved.posterUrl}
            />
          </View>
        )}

        {media.filter((item) => item.type !== "video").length > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <PostMediaSection
              media={media.filter((item) => item.type !== "video")}
              posterUrl={resolved.posterUrl}
            />
          </View>
        ) : null}

        {/* Post Content */}
        <View style={styles.contentSection}>
          {/* Full text */}
          <RichTextRenderer
            richText={(post as any).richText}
            plainText={post.text}
            textStyle={styles.postText}
            selectable={!isClubPost}
          />

          {/* Tags */}
          {tagLabels.length > 0 && (
            <View style={styles.tagsRow}>
              {tagLabels.map((label, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>#{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.dateText}>
              {(() => {
                const d = postDisplayDate(post);
                return d ? formatDate(d) : "";
              })()}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={handleLike}
                style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <MaterialIcons
                  name={isLiked ? "favorite" : "favorite-border"}
                  size={22}
                  color={isLiked ? "#A85C5C" : BROWN_LIGHT}
                />
                <Text style={[styles.actionText, isLiked && { color: "#A85C5C" }]}>
                  {(post.likeCount ?? 0) + (isLiked ? 1 : 0) - (likedOnServer ? 1 : 0)}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <MaterialIcons
                  name={isSaved ? "bookmark" : "bookmark-border"}
                  size={22}
                  color={isSaved ? GREEN_ACCENT : BROWN_LIGHT}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
      </ImageBackground>
  </ScreenContainer>
  );
}

export default function PostDetailScreen() {
  return (
    <ScreenErrorBoundary message="Не удалось открыть пост">
      <PostDetailScreenInner />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D8",
    backgroundColor: CREAM_BG,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN_DARK,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 14, color: BROWN_LIGHT },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  photoSection: { width: "100%", backgroundColor: "#F5F0E8" },
  photoSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    justifyContent: "center",
    alignItems: "center",
  },
  photoImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D8D2C6",
  },
  dotActive: {
    backgroundColor: GREEN_ACCENT,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  photoCounter: {
    fontSize: 11,
    color: BROWN_LIGHT,
    marginLeft: 8,
  },
  contentSection: {
    padding: 20,
    gap: 16,
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#EEE9E0",
    borderRadius: 12,
  },
  tagText: { fontSize: 12, color: BROWN_LIGHT, fontWeight: "500" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8E2D8",
  },
  dateText: { fontSize: 13, color: BROWN_LIGHT },
  actions: { flexDirection: "row", gap: 16, alignItems: "center" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  actionText: { fontSize: 13, color: BROWN_LIGHT },
});
