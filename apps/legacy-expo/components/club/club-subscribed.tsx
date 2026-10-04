import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Text,
  View,
  Pressable,
  FlatList,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
  ImageBackground,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { TabHeader } from "@/components/tab-header";
import { CLUB_MUSIC_URL } from "@/lib/tab-assets";
import { READABLE_ITALIC_STYLE } from "@/lib/brand-font";
import { PenPals } from "@/components/club/pen-pals";
import { ProfileSetup } from "@/components/club/profile-setup";
import { TagBoardDrawer } from "@/components/club/tag-board-drawer";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { AdminFAB } from "@/components/admin/admin-fab";
import { PostMenuButton, usePostManagement } from "@/components/post-management";
import { trpc } from "@/lib/trpc";
import { resolvePostVideo } from "@/lib/resolve-post-video";
import { PostMediaSection } from "@/components/media/post-media-section";
import { NaturalPhotoStack } from "@/components/media/natural-photo-stack";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import { displayPostTitle, isRawMediaFilename } from "@shared/media-label";
import { clubTagLabel, isClubRubricTag, postMatchesClubTab, visibleClubTags } from "@shared/club-tags";
import { postHasTag } from "@/lib/post-tags";
import { sanitizePlainPostText, sanitizeRichTextForDisplay } from "@shared/post-text-sanitize";
import { postDisplayDate } from "@/lib/post-date";
import { articleIdFromSource } from "@shared/article-blocks";
import { ClubComments } from "@/components/club/club-comments";
import { PhotoViewer } from "@/components/photo-viewer";
import { useClubContentProtection } from "@/hooks/use-club-protection";
import { useRouter } from "expo-router";
import {
  CLUB_PROFILE_AVATAR_KEY,
  CLUB_PROFILE_GENDER_KEY,
  CLUB_PROFILE_NAME_KEY,
  syncClubProfileToServer,
} from "@/lib/sync-club-profile";

// ─── Seasonal Assets ──────────────────────────────────────────────────────────

// Paper texture (same as app background)
const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

// Tartan backgrounds (fixed, always visible behind content)
const SEASONAL_TARTANS = {
  autumn: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ff49f6ba1a27-NdnEHWCbQbNuKmyB.JPG",
  winter: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ea0b60bea0fe-EhNRvSBlhxWjRXfT.JPG",
};

// Banners (scrollable, at the top of the list — transparent PNG)
const SEASONAL_BANNERS = {
  autumn: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e8e5386d449f-xGuqHGnxPOYPLwJz.webp",
  winter: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ea0b60bea0fe-EhNRvSBlhxWjRXfT.JPG",
};

function getClubSeason(): "autumn" | "winter" {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  // Winter: Nov 20 onwards through Feb
  if ((month === 10 && day >= 20) || month === 11 || month === 0 || month === 1 || (month === 2 && day <= 19)) {
    return "winter";
  }
  return "autumn";
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";
const SAGE = "#8FA87A";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Club Tab Types ─────────────────────────────────────────────────────────

type ClubTab = "podborki" | "community" | "exclusive" | "life";

interface ClubTabItem {
  id: ClubTab;
  label: string;
  stickerUri: string;
}

const CLUB_TABS: ClubTabItem[] = [
  { id: "podborki", label: "Подборки", stickerUri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8cd6e38feb2b-GEblEVfYOlTMcdZL.webp" },
  { id: "community", label: "Комьюнити", stickerUri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbdc4edd1f6-WglvBAnfwHsodSFE.webp" },
  { id: "exclusive", label: "Эксклюзив", stickerUri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4754542d454e-ioZaSTACsHELFmfu.PNG" },
  { id: "life", label: "Лайф", stickerUri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/011254ea51fb-iXlFvAzqcTIXBklq.png" },
];

// Sticker URIs for post actions
const STICKER_LIKE = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/049e3831441b-iirWKYJcvPUnEdXs.webp";
const STICKER_SAVE = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8b44a02c41d1-avIlcuIRwQPHiWEZ.webp";

// Mailbox image for Community tab
const MAILBOX_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ce515dd1f602-yLEBPmBjoZXimIfm.webp";

// ─── Mock Data ──────────────────────────────────────────────────────────────

interface ClubPost {
  id: string;
  title: string;
  preview: string;
  rawText?: string;
  date: string;
  createdAt?: string | Date | null;
  publishedAt?: string | Date | null;
  tags: string[];
  photos?: string[];
  media?: { id: number; type: "video" | "audio" | "document"; url: string; filename?: string | null; mimeType?: string | null; fileSize?: number | null; duration?: number | null }[];
  richText?: { type: "paragraph" | "heading"; children: { text: string; bold?: boolean; italic?: boolean; link?: string }[] }[] | null;
  articleId?: number | null;
  commentCount?: number;
}

const MOCK_POSTS: Record<ClubTab, ClubPost[]> = {
  podborki: [
    {
      id: "p1",
      title: "Подарки к Новому году в стиле cottagecore",
      preview: "Уютные идеи подарков для тех, кто ценит тепло ручной работы и натуральные материалы...",
      date: "25 июля 2026",
      tags: ["подарки", "зима"],
    },
    {
      id: "p2",
      title: "Летний гардероб: лён, хлопок, полевые цветы",
      preview: "Собрала для вас подборку вещей, которые создают ощущение лёгкости и свободы...",
      date: "20 июля 2026",
      tags: ["гардероб", "лето"],
    },
    {
      id: "p3",
      title: "Кино на вечер: 5 фильмов про английскую деревню",
      preview: "Для тех вечеров, когда хочется укутаться в плед и перенестись в другой мир...",
      date: "15 июля 2026",
      tags: ["кино"],
    },
    {
      id: "p4",
      title: "Рецепты: Чай с травами из собственного сада",
      preview: "Мята, мелисса, чабрец — как собрать, высушить и заварить идеальный вечерний чай...",
      date: "10 июля 2026",
      tags: ["рецепты", "сад"],
    },
  ],
  community: [
    {
      id: "c1",
      title: "Вопрос среды: Ваш любимый летний ритуал?",
      preview: "Расскажите, что делает ваше лето особенным — может быть, утренний кофе в саду или вечерние прогулки?",
      date: "23 июля 2026",
      tags: ["community", "summer"],
    },
    {
      id: "c2",
      title: "Делимся: Книги, которые изменили ваш взгляд на дом",
      preview: "Какая книга вдохновила вас на перемены в доме или в отношении к пространству вокруг?",
      date: "16 июля 2026",
      tags: ["community", "books"],
    },
    {
      id: "c3",
      title: "Фотомарафон: Красота в мелочах",
      preview: "На этой неделе делимся фотографиями маленьких деталей, которые делают нашу жизнь красивее...",
      date: "9 июля 2026",
      tags: ["community"],
    },
  ],
  exclusive: [
    {
      id: "e1",
      title: "Письмо июля: О тишине и цветущих садах",
      preview: "Этот месяц я провела в маленькой деревне на юге Англии, где время течёт иначе...",
      date: "1 июля 2026",
      tags: ["письмо месяца"],
    },
    {
      id: "e2",
      title: "Подкаст: Как создать атмосферу дома",
      preview: "Разговор о том, как маленькие детали — свечи, текстиль, запахи — меняют ощущение пространства...",
      date: "10 июля 2026",
      tags: ["подкаст"],
    },
    {
      id: "e3",
      title: "Гид: Ваш идеальный летний сад",
      preview: "Пошаговый гид по созданию уютного сада в английском стиле — от планировки до выбора растений...",
      date: "5 июля 2026",
      tags: ["exclusive", "garden"],
    },
  ],
  life: [
    {
      id: "l1",
      title: "Закулисье: Как снимался летний лукбук",
      preview: "Показываю процесс — от выбора локации до финальных кадров. Всё не так гламурно, как кажется...",
      date: "22 июля 2026",
      tags: ["закулисье"],
    },
    {
      id: "l2",
      title: "Мой день: Утро в саду",
      preview: "Сегодня встала рано, пока роса ещё на траве. Делюсь моментами тихого утра...",
      date: "18 июля 2026",
      tags: ["личное"],
    },
    {
      id: "l3",
      title: "Находки недели: Антикварный рынок в Бате",
      preview: "Фарфоровые чашки, старинные открытки, кружевные салфетки — покажу всё, что нашла...",
      date: "12 июля 2026",
      tags: ["находки"],
    },
  ],
};

// ─── ClubPostCard (with animation) ─────────────────────────────────────────

function ClubPostCard({
  item,
  isSaved,
  isLiked,
  onSave,
  onLike,
  onMenuPress,
  onPhotoPress,
}: {
  item: ClubPost;
  isSaved: boolean;
  isLiked: boolean;
  onSave: () => void;
  onLike: () => void;
  onMenuPress?: () => void;
  onPhotoPress?: (photos: string[], index: number) => void;
}) {
  const router = useRouter();
  const likeScale = useSharedValue(1);
  const saveScale = useSharedValue(1);
  const postId = Number(item.id);
  const canOpen = Number.isFinite(postId) && postId > 0;

  const openPost = () => {
    if (!canOpen) return;
    router.push(`/post/${postId}`);
  };

  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));
  const saveAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const handleLike = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    likeScale.value = withTiming(1.3, { duration: 100, easing: Easing.out(Easing.ease) }, () => {
      likeScale.value = withTiming(1, { duration: 150 });
    });
    onLike();
  };

  const handleSave = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    saveScale.value = withTiming(1.3, { duration: 100, easing: Easing.out(Easing.ease) }, () => {
      saveScale.value = withTiming(1, { duration: 150 });
    });
    onSave();
  };

  const resolved = resolvePostVideo(item.photos, item.media);
  const stackPhotos = resolved.stackPhotos;
  const hasVideo = resolved.hasVideo;
  const showPhotoStack = stackPhotos.length > 0 || hasVideo;
  const otherMedia = item.media?.filter((m) => m.type !== "video") || [];

  return (
    <View style={styles.postCard}>
      <ImageBackground
        source={{ uri: PAPER_TEXTURE_URI }}
        resizeMode="cover"
        style={styles.postCardInner}
        imageStyle={{ borderRadius: 16 }}
      >
        {showPhotoStack ? (
          <View style={styles.postPhotoWrap}>
            <NaturalPhotoStack
              photos={stackPhotos}
              video={hasVideo && resolved.videoUrl ? { url: resolved.videoUrl } : undefined}
              posterUrl={resolved.posterUrl}
              onPhotoPress={onPhotoPress ? (index) => onPhotoPress(stackPhotos, index) : undefined}
            />
            {onMenuPress ? (
              <View style={styles.photoMenu}>
                <PostMenuButton onPress={onMenuPress} />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.postContent}>
          {!showPhotoStack && onMenuPress ? (
            <View style={styles.menuOnlyRow}>
              <PostMenuButton onPress={onMenuPress} />
            </View>
          ) : null}
          <Pressable
            onPress={openPost}
            disabled={!canOpen || Boolean(item.articleId)}
            style={({ pressed }) => [
              canOpen && !item.articleId && pressed && { opacity: 0.92 },
              Platform.OS === "web" && canOpen && !item.articleId ? ({ cursor: "pointer" } as const) : null,
            ]}
          >
            <RichTextRenderer
              richText={item.richText}
              plainText={item.preview}
              textStyle={styles.postPreview}
              selectable={false}
            />
          </Pressable>
          {item.articleId ? (
            <Pressable
              onPress={() => router.push(`/library/article/${item.articleId}` as any)}
              style={styles.readArticleBtn}
            >
              <Text style={styles.readArticleText}>читать →</Text>
            </Pressable>
          ) : null}
          {otherMedia.length > 0 ? (
            <PostMediaSection media={otherMedia} posterUrl={item.photos?.[0]} />
          ) : null}
          {!Number.isNaN(Number(item.id)) ? (
            <ClubComments
              postId={Number(item.id)}
              tags={item.tags}
              createdAt={item.createdAt || null}
              commentCount={item.commentCount}
            />
          ) : null}
          {visibleClubTags(item.tags).length > 0 ? (
            <View style={styles.postTagsRow}>
              {visibleClubTags(item.tags).map((tag, i) => {
                const rubric = isClubRubricTag(tag);
                return (
                <View
                  key={i}
                  style={[styles.postTag, rubric && styles.postTagRubric]}
                  {...(Platform.OS === "web"
                    ? { className: rubric ? "club-post-tag club-post-tag-rubric" : "club-post-tag" }
                    : null)}
                >
                  <Text style={[styles.postTagText, rubric && styles.postTagRubricText]}>
                    {clubTagLabel(tag)}
                  </Text>
                </View>
                );
              })}
            </View>
          ) : null}
          <View style={styles.postActions}>
            <Text style={styles.postDate}>{item.date}</Text>
            <View style={{ flex: 1 }} />
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.6 },
              ]}
              onPress={handleLike}
            >
              <Animated.View style={likeAnimStyle}>
                <Image
                  source={{ uri: STICKER_LIKE }}
                  style={[styles.actionSticker, { opacity: isLiked ? 1 : 0.4 }]}
                  contentFit="contain"
                />
              </Animated.View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.6 },
              ]}
              onPress={handleSave}
            >
              <Animated.View style={saveAnimStyle}>
                <Image
                  source={{ uri: STICKER_SAVE }}
                  style={[styles.actionSticker, { opacity: isSaved ? 1 : 0.4 }]}
                  contentFit="contain"
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

const PROFILE_COMPLETED_KEY = "@darcy_club_profile_completed";

export function ClubSubscribed() {
  const [activeTab, setActiveTab] = useState<ClubTab | null>(null);
  const [showPenPals, setShowPenPals] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null); // null = loading
  const showProfileSetup = false; // reserved for manual trigger if needed
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileGender, setProfileGender] = useState<"female" | "male" | null>(null);
  const [savedClubIds, setSavedClubIds] = useState<Set<string>>(new Set());
  const [likedClubIds, setLikedClubIds] = useState<Set<string>>(new Set());
  const [selectedBoardTag, setSelectedBoardTag] = useState<string | null>(null);
  const { user, refresh, isOwner } = useAuth();
  useClubContentProtection(true);
  const utils = trpc.useUtils();
  const toggleSaveMut = trpc.feed.toggleSave.useMutation({
    onSuccess: () => {
      void utils.feed.savedPosts.invalidate();
      void utils.feed.userInteractions.invalidate();
    },
  });
  const toggleLikeMut = trpc.feed.toggleLike.useMutation();
  const updateProfile = trpc.profile.update.useMutation();
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation();
  const interactions = trpc.feed.userInteractions.useQuery(undefined, { enabled: Boolean(user) });

  const pushProfileToServer = useCallback(async () => {
    if (!user) return;
    await syncClubProfileToServer(
      {
        updateProfile: (input) => updateProfile.mutateAsync(input),
        uploadAvatar: (input) => uploadAvatar.mutateAsync(input),
      },
      { currentAvatarUrl: user.avatarUrl },
    );
    await refresh();
    void utils.club.comments.invalidate();
  }, [user, updateProfile, uploadAvatar, refresh, utils.club.comments]);

  // Admin post management (edit/delete)
  const onRefresh = () => { utils.club.list.invalidate(); };
  const { openMenu, ManagementModals } = usePostManagement(onRefresh);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const listRef = useRef<FlatList<ClubPost>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 360);
  }, []);

  const scrollClubToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const openPhotoViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };

  // Check if profile has been completed (stored locally)
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PROFILE_COMPLETED_KEY),
      AsyncStorage.getItem(CLUB_PROFILE_NAME_KEY),
      AsyncStorage.getItem(CLUB_PROFILE_GENDER_KEY),
      AsyncStorage.getItem("@darcy_saved_club"),
    ]).then(([completed, name, gender, savedRaw]) => {
      // Consider profile completed if flag is set OR if name already exists
      const isCompleted = completed === "true" || (name != null && name.length > 0);
      setProfileCompleted(isCompleted);
      // If name exists but flag wasn't set, fix it for next time
      if (!completed && name) {
        AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true");
      }
      if (name) setProfileName(name);
      if (gender === "female" || gender === "male") setProfileGender(gender);
      if (savedRaw) {
        try { setSavedClubIds(new Set(JSON.parse(savedRaw))); } catch {}
      }
    });
  }, []);

  const profileSyncUserRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user) return;
    if (profileSyncUserRef.current === user.id) return;
    profileSyncUserRef.current = user.id;
    const hasServerAvatar = user.avatarUrl && /^https?:\/\//.test(user.avatarUrl);
    if (hasServerAvatar) return;
    void pushProfileToServer().catch(() => {});
  }, [user?.id, user?.avatarUrl, pushProfileToServer]);

  useEffect(() => {
    const liked = interactions.data?.likedIds || [];
    if (liked.length) {
      setLikedClubIds(new Set(liked.map(String)));
    }
    const saved = interactions.data?.savedIds || [];
    if (saved.length) {
      setSavedClubIds((prev) => {
        const next = new Set(prev);
        for (const id of saved) next.add(String(id));
        return next;
      });
    }
  }, [interactions.data]);

  const handleClubLike = (postId: string) => {
    const idNum = Number(postId);
    if (!Number.isNaN(idNum)) {
      toggleLikeMut.mutate({ postId: idNum });
    }
    setLikedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleClubSave = (postId: string) => {
    const idNum = Number(postId);
    if (!Number.isNaN(idNum)) {
      toggleSaveMut.mutate({ postId: idNum });
    }
    setSavedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      AsyncStorage.setItem("@darcy_saved_club", JSON.stringify([...next]));
      return next;
    });
  };

  // Show profile setup if profile is not yet completed (only after loading finishes)
  // profileCompleted: null = still loading, true = done, false = needs setup
  // Never show for owner/admin
  const needsProfileSetup = profileCompleted === false && !isOwner;

  // Use local profile data for greeting (fallback to user from auth)
  const displayName = profileName || user?.name;
  const displayGender = profileGender || user?.gender;

  // Fetch club posts from DB
  const { data: dbPostsData } = trpc.club.list.useQuery(
    { limit: 200 },
    { refetchOnWindowFocus: false }
  );

  // Convert DB posts to ClubPost format, fallback to mocks if DB is empty
  const dbPosts: ClubPost[] = (dbPostsData?.posts || [])
    .map((p: any) => {
      const cleanLines = String(p.text || "")
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line && !isRawMediaFilename(line));
      const body = cleanLines.join("\n");
      const displayDate = postDisplayDate(p);
      const rawText = sanitizePlainPostText(String(p.text || ""));
      return {
        id: String(p.id),
        title: displayPostTitle(rawText),
        preview: sanitizePlainPostText(body),
        rawText,
        date: displayDate
          ? displayDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
          : "",
        createdAt: displayDate,
        publishedAt: p.publishedAt ?? p.createdAt ?? null,
        tags: (p.tags as string[]) || [],
        photos: p.photos || [],
        media: p.media || [],
        richText: sanitizeRichTextForDisplay(p.richText),
        articleId: articleIdFromSource(p.source),
        commentCount: Number(p.commentCount) || 0,
      };
    })
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  // Use DB posts if available, otherwise fallback to mocks
  const mockPosts = activeTab
    ? MOCK_POSTS[activeTab]
    : Object.values(MOCK_POSTS).flat();

  const allPosts = dbPosts.length > 0 ? dbPosts : mockPosts;
  const tabPosts = activeTab
    ? allPosts.filter((post) => postMatchesClubTab(post.tags, activeTab))
    : allPosts;

  const posts = selectedBoardTag
    ? tabPosts.filter((p) => postHasTag(p.tags, selectedBoardTag))
    : tabPosts;
  const season = getClubSeason();
  const tartanUri = SEASONAL_TARTANS[season];
  const bannerUri = SEASONAL_BANNERS[season];

  const renderPost = ({ item }: { item: ClubPost }) => (
    <ClubPostCard
      item={item}
      isSaved={savedClubIds.has(item.id) || Boolean(interactions.data?.savedIds?.includes(Number(item.id)))}
      isLiked={likedClubIds.has(item.id) || Boolean(interactions.data?.likedIds?.includes(Number(item.id)))}
      onSave={() => handleClubSave(item.id)}
      onLike={() => handleClubLike(item.id)}
      onMenuPress={isOwner && !isNaN(Number(item.id)) ? () => openMenu({
        id: Number(item.id),
        text: (item as ClubPost & { rawText?: string }).rawText ?? item.preview,
        photos: (item as any).photos || [],
        tags: item.tags,
        media: item.media || [],
        richText: item.richText ?? null,
        publishedAt: item.publishedAt ?? item.createdAt ?? null,
        createdAt: item.createdAt ?? null,
        target: "club",
      }) : undefined}
      onPhotoPress={openPhotoViewer}
    />
  );

  // Banner image as the first element in the scrollable list
  const ListHeader = () => (
    <View>
      {bannerUri ? (
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: bannerUri }}
            style={styles.bannerImage}
            contentFit="cover"
            contentPosition="top"
          />
        </View>
      ) : null}
      {/* Greeting only on main (no tab selected) */}
      {activeTab === null && displayName ? (
        <Text style={styles.greeting}>
          Очень рада тебе, {displayGender === "female" ? "дорогая " : displayGender === "male" ? "дорогой " : ""}{displayName}
        </Text>
      ) : null}
      {/* Mailbox + Pen Pals CTA on Community tab */}
      {activeTab === "community" ? (
        <View style={styles.communityIntro}>
          <Text style={styles.wednesdayNote}>Каждую среду — день тёплого общения</Text>
          <View style={styles.mailboxSection}>
            <Image
              source={{ uri: MAILBOX_URI }}
              style={styles.mailboxImage}
              contentFit="contain"
            />
            <Pressable
              style={({ pressed }) => [
                styles.penPalsCta,
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => setShowPenPals(true)}
            >
              <Text style={styles.penPalsCtaText}>найти друга по переписке →</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {/* Active tag filter indicator */}
      {selectedBoardTag ? (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterLabel}>Фильтр:</Text>
          <Pressable
            style={({ pressed }) => [
              styles.activeFilterChip,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => setSelectedBoardTag(null)}
          >
            <Text style={styles.activeFilterChipText}>{selectedBoardTag} ×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <ImageBackground
      source={{ uri: tartanUri }}
      style={styles.tartanBackground}
      resizeMode="cover"
    >
      <SafeAreaView edges={["left", "right"]} style={styles.safeArea}>
        {/* Header icons overlay */}
        <View style={styles.headerOverlay}>
          <TabHeader musicUrl={CLUB_MUSIC_URL} />
        </View>

        {/* Content — banner scrolls with posts, tartan stays fixed behind */}
        <FlatList
          ref={listRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={
            activeTab ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>Пока нет публикаций в этом разделе</Text>
              </View>
            ) : null
          }
          stickyHeaderIndices={[]}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
        />



        {/* Internal Tab Bar */}
        <ImageBackground
          source={{ uri: PAPER_TEXTURE_URI }}
          resizeMode="cover"
          style={styles.clubTabBar}
        >
          {CLUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={styles.clubTabItem}
                onPress={() => setActiveTab(isActive ? null : tab.id)}
              >
                <View style={styles.tabStickerContainer}>
                  <Image
                    source={{ uri: tab.stickerUri }}
                    style={[
                      styles.tabSticker,
                      (tab.id === "community") && styles.tabStickerXL,
                      (tab.id === "exclusive") && styles.tabStickerLarge,
                    ]}
                    contentFit="contain"
                  />
                </View>
                <Text
                  style={[
                    styles.clubTabLabel,
                    isActive && styles.clubTabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ImageBackground>

        {/* Pen Pals Modal */}
        {showPenPals ? (
          <Modal visible animationType="slide" presentationStyle="pageSheet">
            <PenPals onClose={() => setShowPenPals(false)} />
          </Modal>
        ) : null}

        {/* Tag Board Drawer */}
        <TagBoardDrawer
          selectedTag={selectedBoardTag}
          onSelectTag={setSelectedBoardTag}
        />

        {/* Profile Setup Modal — shown only once for new users who haven't set up profile */}
        {needsProfileSetup ? (
          <Modal visible animationType="slide" presentationStyle="pageSheet">
            <View style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
              <Pressable
                onPress={async () => {
                  await AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true");
                  setProfileCompleted(true);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 8 }]}
              >
                <MaterialIcons name="close" size={24} color="#4A3728" />
              </Pressable>
            </View>
            <ProfileSetup
              onComplete={async (data) => {
                await AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true");
                await AsyncStorage.setItem(CLUB_PROFILE_NAME_KEY, data.name);
                await AsyncStorage.setItem(CLUB_PROFILE_GENDER_KEY, data.gender);
                if (data.avatarUrl) {
                  await AsyncStorage.setItem(CLUB_PROFILE_AVATAR_KEY, data.avatarUrl);
                }
                setProfileCompleted(true);
                setProfileName(data.name);
                setProfileGender(data.gender);
                if (user) {
                  await pushProfileToServer();
                } else {
                  await refresh();
                }
              }}
            />
          </Modal>
        ) : null}
      </SafeAreaView>
      {isOwner && <ManagementModals />}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
      <ScrollToTopButton visible={showScrollTop} onPress={scrollClubToTop} bottom={120} />
      <AdminFAB target="club" />
    </ImageBackground>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Tartan background — fixed, always visible
  tartanBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  // Banner container — clips the transparent bottom of the PNG
  bannerContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.55, // show only the top portion with actual content
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },

  // Personalized greeting
  greeting: {
    fontFamily: "Gogol-Regular",
    fontSize: 22,
    color: CREAM,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 20,
  },

  // Post list
  postList: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 110,
    gap: 14,
  },
  emptyTab: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyTabText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: "#FDF8F0",
    textAlign: "center",
    opacity: 0.85,
  },

  // Post card
  postCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.12)",
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  postCardInner: {
    overflow: "hidden",
    borderRadius: 16,
  },
  postPhotoWrap: {
    position: "relative",
    width: "100%",
    backgroundColor: "transparent",
  },
  postVideoWrap: {
    paddingHorizontal: 0,
  },
  photoMenu: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: "rgba(253, 248, 240, 0.9)",
    borderRadius: 16,
  },
  menuOnlyRow: {
    alignItems: "flex-end",
    marginBottom: 4,
  },
  postContent: {
    padding: 16,
    gap: 6,
  },
  postTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  postTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: "rgba(143,168,122,0.22)",
    overflow: "hidden",
  },
  postTagRubric: {
    backgroundColor: "rgba(92,64,51,0.16)",
  },
  postTagText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: "EBGaramond-Regular",
    fontWeight: "400",
    color: OLIVE,
    letterSpacing: 0.15,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  postTagRubricText: {
    color: BROWN,
  },
  postPreview: {
    fontSize: 17,
    fontFamily: "EBGaramond-Regular",
    color: "#3C2A1A",
    lineHeight: 24,
    marginTop: 0,
  },
  readArticleBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  readArticleText: {
    fontSize: 16,
    ...READABLE_ITALIC_STYLE,
    color: OLIVE,
  },
  postDate: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: "#A89880",
    marginTop: 4,
  },

  communityIntro: {
    marginTop: 4,
    marginBottom: 8,
  },
  wednesdayNote: {
    fontFamily: "Gogol-Regular",
    fontSize: 22,
    color: CREAM,
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  mailboxSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  mailboxImage: {
    width: 64,
    height: 85,
  },
  penPalsCta: {
    flex: 1,
    backgroundColor: "rgba(245, 237, 224, 0.85)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 4,
  },
  penPalsCtaText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: "#3B2A1A",
    letterSpacing: 1,
    textAlign: "center",
  },

  // Internal Club Tab Bar
  clubTabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingTop: 10,
    paddingBottom: Platform.OS === "web" ? 14 : 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(139,115,85,0.15)",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  clubTabItem: {
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingHorizontal: 8,
  },
  tabStickerContainer: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  clubTabLabel: {
    fontSize: 10,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    letterSpacing: 0.3,
  },
  clubTabLabelActive: {
    color: BROWN,
    fontFamily: "EBGaramond-SemiBold",
  },
  tabSticker: {
    width: 32,
    height: 32,
  },
  tabStickerLarge: {
    width: 40,
    height: 40,
  },
  tabStickerXL: {
    width: 46,
    height: 46,
  },

  // Post action buttons (like / save)
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(139,115,85,0.1)",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionSticker: {
    width: 30,
    height: 30,
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },

  // Active filter indicator
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  activeFilterLabel: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: CREAM,
    letterSpacing: 0.5,
  },
  activeFilterChip: {
    backgroundColor: "rgba(253, 248, 240, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  activeFilterChipText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN,
    letterSpacing: 0.3,
  },
});
