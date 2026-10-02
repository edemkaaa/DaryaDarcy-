import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { postDisplayDate } from "@/lib/post-date";
import {
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing } from "react-native-reanimated";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { PhotoViewer } from "@/components/photo-viewer";
import { splitVideoPhotos } from "@/lib/post-media-photos";
import { PostMenuButton, usePostManagement } from "@/components/post-management";
import { useAuth } from "@/hooks/use-auth";
import { TabHeader } from "@/components/tab-header";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { AdminFAB } from "@/components/admin/admin-fab";
import { PostMediaSection } from "@/components/media/post-media-section";
import { NaturalPhotoStack } from "@/components/media/natural-photo-stack";
import { FEED_TAGS, postTagLabel } from "@/lib/post-tags";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import { articleIdFromSource } from "@shared/article-blocks";
import { sanitizePhotoUrls } from "@/lib/photo-urls";
import { sanitizeRichTextForDisplay } from "@shared/post-text-sanitize";

// ── Types ──
type ViewMode = "feed" | "grid";

type TagSlug = string;

interface Tag {
  slug: TagSlug;
  label: string;
}

interface FeedPost {
  id: number;
  text: string;
  photos: string[];
  tags: string[];
  date: string;
  likeCount: number;
  media?: { id: number; type: "video" | "audio" | "document"; url: string; filename?: string | null; mimeType?: string | null; fileSize?: number | null; duration?: number | null }[];
  richText?: { type: "paragraph" | "heading"; children: { text: string; bold?: boolean; italic?: boolean; link?: string }[] }[] | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  target?: "feed" | "club" | "both";
  articleId?: number | null;
}

// ── Constants ──
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 1;
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const GRID_ITEM_HEIGHT = GRID_ITEM_SIZE * (5 / 4); // 4:5 aspect ratio
const MAX_TEXT_LINES = 3;

const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const GREEN_ACCENT = "#8B7355"; // Brown accent (was green)

// ── Default Tags (fallback if DB not available) ──
const DEFAULT_TAGS: Tag[] = [
  { slug: "all", label: "Все" },
  ...FEED_TAGS,
];

const FEED_BANNER_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/feed/banner-shelf-v2.jpg";

// ── Season helper ──
function getCurrentSeason(): { slug: TagSlug; label: string; bannerImage: string; subtitle: string } {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4)
    return {
      slug: "spring",
      label: "Весна",
      bannerImage: FEED_BANNER_URI,
      subtitle: "Пробуждение природы",
    };
  if (month >= 5 && month <= 7)
    return {
      slug: "summer",
      label: "Лето",
      bannerImage: FEED_BANNER_URI,
      subtitle: "Солнечные дни",
    };
  if (month >= 8 && month <= 10)
    return {
      slug: "autumn",
      label: "Осень",
      bannerImage: FEED_BANNER_URI,
      subtitle: "Уютное время",
    };
  return {
    slug: "winter",
    label: "Зима",
    bannerImage: FEED_BANNER_URI,
    subtitle: "Тёплые вечера",
  };
}

// ── Mock data (fallback) ──
const MOCK_POSTS: FeedPost[] = [
  {
    id: 1,
    text: "Организация кухонной кладовки 🌿\n\nВесенний домашний влог: как создать порядок и красоту в самом сердце дома. Каждая баночка на своём месте, каждая полка — маленькая история.\n\nДелитесь, как вы организуете хранение на кухне?",
    photos: [
      "https://i.ytimg.com/vi/_RZRJgVSD8Y/maxresdefault.jpg",
      "https://i.ytimg.com/vi/Atx0utYvuGY/maxresdefault.jpg",
      "https://i.ytimg.com/vi/sq7pY1H_fYU/maxresdefault.jpg",
    ],
    tags: ["spring", "home"],
    date: "20 апреля 2026",
    likeCount: 142,
  },
  {
    id: 2,
    text: "Синяя ванная: история ремонта 💙\n\nКак по крупицам собирался интерьер одной из самых необычных комнат в доме. Плитка ручной работы, латунные краны, зеркало с блошиного рынка — каждая деталь искалась месяцами.",
    photos: [
      "https://i.ytimg.com/vi/EQZDRiE8q5w/maxresdefault.jpg",
      "https://i.ytimg.com/vi/KdshzJVnPvE/maxresdefault.jpg",
    ],
    tags: ["home", "styling"],
    date: "18 апреля 2026",
    likeCount: 98,
  },
  {
    id: 3,
    text: "Весеннее рагу для уютного вечера 🍲\n\nРецепт наваристого рагу из сезонных овощей, которое согреет душу.",
    photos: ["https://i.ytimg.com/vi/sq7pY1H_fYU/maxresdefault.jpg"],
    tags: ["spring", "recipes"],
    date: "15 апреля 2026",
    likeCount: 215,
  },
  {
    id: 4,
    text: "10 правил уютного дома ✨\n\nКак сделать уютным любой дом: простые секреты, которые работают.",
    photos: [
      "https://i.ytimg.com/vi/Atx0utYvuGY/maxresdefault.jpg",
      "https://i.ytimg.com/vi/_RZRJgVSD8Y/maxresdefault.jpg",
      "https://i.ytimg.com/vi/EQZDRiE8q5w/maxresdefault.jpg",
      "https://i.ytimg.com/vi/sq7pY1H_fYU/maxresdefault.jpg",
    ],
    tags: ["home", "styling"],
    date: "12 апреля 2026",
    likeCount: 324,
  },
  {
    id: 5,
    text: "Мой весенний гардероб 🌸\n\nКак сочетать винтажные находки с современными вещами для создания неповторимого стиля.",
    photos: [
      "https://i.ytimg.com/vi/ebhuppZFsm0/maxresdefault.jpg",
      "https://i.ytimg.com/vi/PH9jmflqKb8/maxresdefault.jpg",
      "https://i.ytimg.com/vi/KdshzJVnPvE/maxresdefault.jpg",
      "https://i.ytimg.com/vi/Z5rXIxkXUoM/maxresdefault.jpg",
      "https://i.ytimg.com/vi/_RZRJgVSD8Y/maxresdefault.jpg",
      "https://i.ytimg.com/vi/Atx0utYvuGY/maxresdefault.jpg",
    ],
    tags: ["spring", "outfits"],
    date: "10 апреля 2026",
    likeCount: 187,
  },
];

// ── Format date helper ──
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}


function normalizeFeedPost(p: Record<string, unknown>): FeedPost {
  const photos = sanitizePhotoUrls(p.photos);
  const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
  const text = typeof p.text === "string" ? p.text : "";
  const richText = sanitizeRichTextForDisplay(p.richText);
  const media = Array.isArray(p.media) ? (p.media as FeedPost["media"]) : [];
  const targetRaw = p.target;
  const target =
    targetRaw === "club" || targetRaw === "both" || targetRaw === "feed" ? targetRaw : "feed";

  return {
    id: Number(p.id),
    text,
    photos,
    tags,
    date: (() => {
      const d = postDisplayDate(p as Parameters<typeof postDisplayDate>[0]);
      return d ? formatDate(d) : "";
    })(),
    likeCount: typeof p.likeCount === "number" ? p.likeCount : 0,
    media,
    richText,
    publishedAt: (p.publishedAt as FeedPost["publishedAt"]) ?? (p.createdAt as FeedPost["createdAt"]) ?? null,
    createdAt: (p.createdAt as FeedPost["createdAt"]) ?? null,
    target,
    articleId: articleIdFromSource(typeof p.source === "string" ? p.source : null),
  };
}


// ── Post Card Component ──
function PostCard({ post, isLiked, isSaved, likedOnServer, onLike, onSave, onPress, onPhotoPress, onMenuPress }: {
  post: FeedPost;
  isLiked: boolean;
  isSaved: boolean;
  likedOnServer: boolean;
  onLike: (postId: number) => void;
  onSave: (postId: number) => void;
  onPress: (postId: number) => void;
  onPhotoPress?: (photos: string[], index: number) => void;
  onMenuPress?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const saveScale = useSharedValue(1);
  const likeScale = useSharedValue(1);

  const saveAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));
  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const needsExpand = post.text.length > 0 && (post.text.split("\n").length > MAX_TEXT_LINES || post.text.length > 150);

  const handleLike = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    likeScale.value = withTiming(1.3, { duration: 100, easing: Easing.out(Easing.ease) }, () => {
      likeScale.value = withTiming(1, { duration: 150 });
    });
    onLike(post.id);
  };

  const handleSave = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    saveScale.value = withTiming(1.3, { duration: 100, easing: Easing.out(Easing.ease) }, () => {
      saveScale.value = withTiming(1, { duration: 150 });
    });
    onSave(post.id);
  };

  const tagLabels = (post.tags || [])
    .map((slug) => postTagLabel(slug))
    .filter(Boolean);

  const hasVideo = Boolean((post.media || []).some((item) => item.type === "video"));
  const videoItem = post.media?.find((item) => item.type === "video");
  const videoFile = videoItem?.filename;
  const { posterUrl, galleryPhotos } = splitVideoPhotos(post.photos || [], videoFile);
  const stackPhotos = hasVideo ? galleryPhotos : (post.photos || []);
  const otherMedia = (post.media || []).filter((item) => item.type !== "video");

  return (
    <Pressable style={styles.postCard} onPress={() => onPress(post.id)}>
      {(hasVideo || (stackPhotos && stackPhotos.length > 0)) ? (
        <NaturalPhotoStack
          photos={stackPhotos || []}
          video={hasVideo && videoItem ? { url: videoItem.url } : undefined}
          posterUrl={posterUrl}
          onPhotoPress={onPhotoPress ? (index) => onPhotoPress(stackPhotos || [], index) : undefined}
        />
      ) : null}
      <View style={styles.postContent}>
        {expanded ? (
          <RichTextRenderer
            richText={post.richText}
            plainText={post.text}
            textStyle={styles.postText}
          />
        ) : (
          <RichTextRenderer
            richText={post.richText}
            plainText={post.text}
            numberOfLines={MAX_TEXT_LINES}
            textStyle={styles.postText}
          />
        )}
        {post.articleId ? (
          <Pressable onPress={() => onPress(post.id)} style={styles.expandButton}>
            <Text style={styles.expandButtonText}>читать →</Text>
          </Pressable>
        ) : needsExpand && !expanded ? (
          <Pressable onPress={() => setExpanded(true)} style={styles.expandButton}>
            <Text style={styles.expandButtonText}>Читать дальше →</Text>
          </Pressable>
        ) : null}
        {expanded && !post.articleId && (
          <Pressable onPress={() => setExpanded(false)} style={styles.expandButton}>
            <Text style={styles.expandButtonText}>свернуть</Text>
          </Pressable>
        )}

        {otherMedia.length > 0 ? (
          <PostMediaSection media={otherMedia} posterUrl={post.photos?.[0]} />
        ) : null}

        <View style={styles.postTagsRow}>
          {tagLabels.map((label, i) => (
            <View key={i} style={styles.postTag}>
              <Text style={styles.postTagText}>#{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.postFooter}>
          <Text style={styles.postDate}>{post.date}</Text>
          <View style={styles.postActions}>
            <Pressable onPress={handleLike} style={styles.actionButton}>
              <Animated.View style={likeAnimStyle}>
                <MaterialIcons
                  name={isLiked ? "favorite" : "favorite-border"}
                  size={20}
                  color={isLiked ? "#A85C5C" : BROWN_LIGHT}
                />
              </Animated.View>
              <Text style={[styles.actionCount, isLiked && { color: "#A85C5C" }]}>
                {Math.max(0, post.likeCount + (isLiked ? 1 : 0) - (likedOnServer ? 1 : 0))}
              </Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.actionButton}>
              <Animated.View style={saveAnimStyle}>
                <MaterialIcons
                  name={isSaved ? "work" : "work-outline"}
                  size={19}
                  color={isSaved ? GREEN_ACCENT : BROWN_LIGHT}
                />
              </Animated.View>
            </Pressable>
            {onMenuPress && (
              <PostMenuButton onPress={onMenuPress} />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── Grid Item with press animation ──
function GridItem({ item, isVideo, onPress }: { item: FeedPost; isVideo: boolean; onPress: (id: number) => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    scale.value = withTiming(0.95, { duration: 80, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        scale.value = withTiming(1, { duration: 120 });
        runOnJS(onPress)(item.id);
      }
    });
  }, [item.id, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.gridItem}
    >
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {item.photos?.[0] ? (
          <Image source={{ uri: item.photos[0] }} style={styles.gridImage} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.gridImage, { backgroundColor: "#4A3728" }]} />
        )}
        {isVideo && (
          <View style={styles.gridPlayIcon}>
            <MaterialIcons name="play-circle-filled" size={20} color="rgba(255,255,255,0.9)" />
          </View>
        )}
        {(item.photos?.length ?? 0) > 1 && !isVideo && (
          <View style={styles.gridMultiIcon}>
            <MaterialIcons name="collections" size={18} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ── Main Feed Screen ──
export default function FeedScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isOwner } = useAuth();
  const utils = trpc.useUtils();
  const likeMut = trpc.feed.toggleLike.useMutation();
  const saveMut = trpc.feed.toggleSave.useMutation({
    onSuccess: () => {
      void utils.feed.savedPosts.invalidate();
      void utils.feed.userInteractions.invalidate();
    },
  });
  const interactions = trpc.feed.userInteractions.useQuery(undefined, { enabled: Boolean(user) });
  const [selectedTag, setSelectedTag] = useState<TagSlug>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [localLiked, setLocalLiked] = useState<Set<number>>(new Set());
  const [serverLiked, setServerLiked] = useState<Set<number>>(new Set());
  const [localSaved, setLocalSaved] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Photo viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const listRef = useRef<FlatList<FeedPost>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 360);
  }, []);

  const scrollFeedToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch posts from API with pagination and search
  const {
    data: paginatedData,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.feed.listPaginated.useInfiniteQuery(
    {
      tag: selectedTag === "all" ? undefined : selectedTag,
      search: debouncedSearch || undefined,
      limit: 12,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      retry: 1,
    }
  );

  // Fetch tags from API
  const { data: apiTags } = trpc.feed.tags.useQuery(undefined, { retry: 1 });

  // Use API data or fallback to mock
  const TAGS: Tag[] = useMemo(() => {
    if (apiTags && apiTags.length > 0) {
      return [{ slug: "all" as TagSlug, label: "Все" }, ...apiTags.map((t) => ({ slug: t.slug as TagSlug, label: t.label }))];
    }
    return DEFAULT_TAGS;
  }, [apiTags]);

  const posts: FeedPost[] = useMemo(() => {
    if (paginatedData?.pages) {
      const allPosts = paginatedData.pages
        .flatMap((page) => page.posts)
        .filter((p) => p.target !== "club");
      if (allPosts.length > 0) {
        return allPosts.map((p) => normalizeFeedPost(p as Record<string, unknown>));
      }
    }
    // Fallback to mock data with tag filter
    if (selectedTag === "all") return MOCK_POSTS;
    return MOCK_POSTS.filter((p) => p.tags.includes(selectedTag));
  }, [paginatedData, selectedTag]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void utils.feed.listPaginated.invalidate().finally(() => {
      refetch().finally(() => setRefreshing(false));
    });
  }, [refetch, utils.feed.listPaginated]);

  const handleTagPress = (slug: TagSlug) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedTag(slug);
  };

  const handleLike = (postId: number) => {
    if (!user) {
      router.push("/login?next=/feed" as any);
      return;
    }
    setLocalLiked((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    likeMut.mutate({ postId });
  };

  const handleSave = (postId: number) => {
    if (!user) {
      router.push("/login?next=/feed" as any);
      return;
    }
    setLocalSaved((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      AsyncStorage.setItem("@darcy_saved_feed", JSON.stringify([...next]));
      return next;
    });
    saveMut.mutate({ postId });
  };

  useEffect(() => {
    if (!interactions.data) return;
    setServerLiked(new Set(interactions.data.likedIds));
    setLocalLiked(new Set(interactions.data.likedIds));
    setLocalSaved(new Set(interactions.data.savedIds));
    AsyncStorage.setItem("@darcy_saved_feed", JSON.stringify(interactions.data.savedIds));
  }, [interactions.data]);

  // Load saved feed posts from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem("@darcy_saved_feed").then((raw) => {
      if (raw) {
        try {
          const ids = JSON.parse(raw) as number[];
          setLocalSaved(new Set(ids));
        } catch {}
      }
    });
  }, []);

  const openViewer = useCallback((photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  // ── Seasonal Banner ──
  const renderBanner = () => (
    <View style={styles.bannerContainer}>
      <Image
        source={{ uri: FEED_BANNER_URI }}
        style={styles.bannerImage}
        contentFit="cover"
        transition={300}
      />
    </View>
  );

  // ── Search Bar + View Toggle (same row) ──
  const renderSearchRow = () => (
    <View style={styles.searchRow}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={18} color={BROWN_LIGHT} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск..."
          placeholderTextColor={BROWN_LIGHT}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <MaterialIcons name="close" size={18} color={BROWN_LIGHT} />
          </Pressable>
        )}
      </View>
      {viewMode === "grid" && (
        <Pressable
          onPress={() => router.push("/(tabs)/videos" as any)}
          style={[styles.videoFilterButton]}
        >
          <MaterialIcons
            name="play-circle-filled"
            size={14}
            color={BROWN_LIGHT}
          />
          <Text style={[styles.videoFilterText]}>
            Видео
          </Text>
        </Pressable>
      )}
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setViewMode("feed")}
          style={[styles.toggleButton, viewMode === "feed" && styles.toggleButtonActive]}
        >
          <MaterialIcons name="view-agenda" size={16} color={viewMode === "feed" ? CREAM_BG : BROWN_LIGHT} />
        </Pressable>
        <Pressable
          onPress={() => setViewMode("grid")}
          style={[styles.toggleButton, viewMode === "grid" && styles.toggleButtonActive]}
        >
          <MaterialIcons name="grid-view" size={16} color={viewMode === "grid" ? CREAM_BG : BROWN_LIGHT} />
        </Pressable>
      </View>
    </View>
  );

  // ── Tag Chips (full-width row) ──
  const renderTagChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScrollContent}
      style={styles.chipScroll}
    >
      {TAGS.map((tag) => {
        const isActive = selectedTag === tag.slug;
        return (
          <Pressable
            key={tag.slug}
            onPress={() => handleTagPress(tag.slug)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {tag.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // ── Grid Item ──
  const isVideoPost = (post: FeedPost) =>
    (post.tags || []).includes("video") ||
    (post.media || []).some((item) => item.type === "video") ||
    (post.photos || []).some((url) => /\.(mp4|mov|webm)$/i.test(url));

  const navigateToPost = useCallback((postId: number) => {
    router.push(`/post/${postId}`);
  }, []);

  const renderGridItem = ({ item }: { item: FeedPost }) => (
    <GridItem item={item} isVideo={isVideoPost(item)} onPress={navigateToPost} />
  );

  // ── Header ──
  const renderHeader = () => (
    <View style={{ position: "relative" }}>
      {renderBanner()}
      <TabHeader />
      {renderSearchRow()}
      {renderTagChips()}
    </View>
  );

  const handlePostPress = (postId: number) => {
    const post = posts.find((item) => item.id === postId);
    if (post?.articleId) {
      router.push(`/library/article/${post.articleId}` as any);
      return;
    }
    router.push(`/post/${postId}`);
  };

  // Post management (owner only)
  const { openMenu, ManagementModals } = usePostManagement(onRefresh);

  // ── Feed Item ──
  const renderFeedItem = ({ item }: { item: FeedPost }) => (
    <PostCard
      post={item}
      isLiked={localLiked.has(item.id)}
      isSaved={localSaved.has(item.id)}
      likedOnServer={serverLiked.has(item.id)}
      onLike={handleLike}
      onSave={handleSave}
      onPress={handlePostPress}
      onPhotoPress={openViewer}
      onMenuPress={isOwner ? () => openMenu({
        id: item.id,
        text: item.text,
        photos: item.photos,
        tags: item.tags,
        richText: item.richText ?? null,
        publishedAt: item.publishedAt ?? null,
        createdAt: item.createdAt ?? null,
        target: item.target || "feed",
      }) : undefined}
    />
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={GREEN_ACCENT} />
          <Text style={styles.footerText}>Загрузка...</Text>
        </View>
      );
    }
    if (!hasNextPage && posts.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <Text style={styles.footerText}>Все посты загружены</Text>
        </View>
      );
    }
    return null;
  };

  // ── Loading state ──
  if (isLoading && !paginatedData) {
    return (
      <ScreenContainer>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GREEN_ACCENT} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {viewMode === "feed" ? (
        <FlatList
          ref={listRef}
          key="feed"
          data={posts}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== "web"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GREEN_ACCENT}
              colors={[GREEN_ACCENT]}
              progressBackgroundColor={CREAM_BG}
            />
          }
        />
      ) : (
        <FlatList
          ref={listRef}
          key="grid"
          data={posts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={GRID_COLUMNS}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GREEN_ACCENT}
              colors={[GREEN_ACCENT]}
              progressBackgroundColor={CREAM_BG}
            />
          }
        />
      )}
      {viewerVisible ? (
        <PhotoViewer
          visible={viewerVisible}
          photos={viewerPhotos}
          initialIndex={viewerInitialIndex}
          onClose={closeViewer}
        />
      ) : null}
      {isOwner ? <ManagementModals /> : null}
      <ScrollToTopButton visible={showScrollTop} onPress={scrollFeedToTop} />
      <AdminFAB target="feed" />
    </ScreenContainer>
  );
}

// ── Styles ──
const styles = StyleSheet.create({

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  bannerContainer: {
    width: "100%",
    aspectRatio: 1024 / 183,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#4A3728",
  },
  bannerImage: { width: "100%", height: "100%" },
  // Search row: search bar + toggle on same line
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 115, 85, 0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(139, 115, 85, 0.15)",
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_DARK,
    paddingVertical: 0,
  },
  videoFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#EEE9E0",
    marginLeft: 8,
  },
  videoFilterButtonActive: {
    backgroundColor: GREEN_ACCENT,
  },
  videoFilterText: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_LIGHT,
  },
  videoFilterTextActive: {
    color: CREAM_BG,
  },
  toggleRow: { flexDirection: "row", gap: 4 },
  toggleButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEE9E0",
  },
  toggleButtonActive: { backgroundColor: GREEN_ACCENT },
  // Tag chips — full-width row
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chipScrollContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#EEE9E0",
    borderWidth: 1,
    borderColor: "#D8D2C6",
  },
  chipActive: { backgroundColor: GREEN_ACCENT, borderColor: GREEN_ACCENT },
  chipText: {
    fontSize: 13,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_DARK,
    letterSpacing: 0.3,
  },
  chipTextActive: { color: CREAM_BG },
  listContent: { paddingBottom: 100 },
  postCard: {
    marginHorizontal: 0,
    marginTop: 12,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  postContent: { padding: 14, gap: 8 },
  postText: {
    fontSize: 17,
    lineHeight: 25,
    color: "#3C2A1A",
    fontFamily: "EBGaramond-Regular",
  },
  expandButton: { marginTop: 2 },
  expandButtonText: {
    fontSize: 14,
    color: GREEN_ACCENT,
    fontFamily: "EBGaramond-Regular",
    letterSpacing: 0.5,
  },
  postTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  postTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#EEE9E0" },
  postTagText: {
    fontSize: 13,
    color: BROWN_LIGHT,
    fontFamily: "EBGaramond-Regular",
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  postDate: { fontSize: 12, color: BROWN_LIGHT, fontFamily: "EBGaramond-Italic" },
  postActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  actionCount: { fontSize: 12, color: BROWN_LIGHT, fontFamily: "EBGaramond-Regular" },
  gridContent: { paddingBottom: 100 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: GRID_ITEM_SIZE, height: GRID_ITEM_HEIGHT, position: "relative" },
  gridImage: { width: "100%", height: "100%" },
  gridMultiIcon: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  gridPlayIcon: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: BROWN_LIGHT,
    fontFamily: "EBGaramond-Italic",
  },
});
