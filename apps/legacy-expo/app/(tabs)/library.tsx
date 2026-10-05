import { useState, useMemo } from "react";
import { router } from "expo-router";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { TabHeader } from "@/components/tab-header";
import { useClub } from "@/lib/club-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const DEFAULT_COVER_ASPECT = 0.75;

const BANNER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/549a6bdf3cb0-aeHHNBoBXpIdgjhp.jpeg";
const GUIDE_BANNER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg";
const STILIZACII_COVER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3b8642166933-rdRVzYWvuGEmSUdF.jpeg";
const STILIZACII_YANDEX_URL = "https://disk.yandex.ru/i/Y-XvbPF-NwOiLg";
const RECIPES_COVER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/877a6c2a49ef-JZjLEpuxmhqHszUD.jpg";
const RECIPES_YANDEX_URL = "https://disk.yandex.ru/i/nUoIS8gQ5VkClA";
const PETERBURG_COVER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/925076516046-CkdCchNXtpJkPNVd.JPG";
const PETERBURG_YANDEX_URL = "https://disk.yandex.ru/d/BM0uzv2cWZeM0Q";
const PATTERNS_COVER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg";
const LOSHADKA_COVER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/library/loshadka-cover.jpg";
const LOSHADKA_YANDEX_URL = "https://disk.yandex.ru/i/nDfsd5ptLO1xRA";
const ABOUT_ME_COVER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG";

// Colors
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const OLIVE_BG = "#e4e0cd";

interface MaterialItem {
  id: string;
  title: string;
  coverUrl: string;
  coverAspectRatio: number; // width/height
  isClubOnly: boolean;
  action: "navigate" | "pdf" | "browser";
  route?: string;
  pdfUrl?: string;
}

const MATERIALS: MaterialItem[] = [
  {
    id: "aesthetics-guide",
    title: "Гид по эстетикам",
    coverUrl: GUIDE_BANNER_URL,
    coverAspectRatio: 1.4,
    isClubOnly: true,
    action: "navigate",
    route: "/library/aesthetics-guide",
  },
  {
    id: "about-me",
    title: "Обо мне",
    coverUrl: ABOUT_ME_COVER_URL,
    coverAspectRatio: 0.75,
    isClubOnly: false,
    action: "navigate",
    route: "/library/about-me",
  },
  {
    id: "stilizacii",
    title: "Сборник стилизаций",
    coverUrl: STILIZACII_COVER_URL,
    coverAspectRatio: 0.58,
    isClubOnly: false,
    action: "browser",
    pdfUrl: STILIZACII_YANDEX_URL,
  },
  {
    id: "recipes",
    title: "Сборник рецептов",
    coverUrl: RECIPES_COVER_URL,
    coverAspectRatio: 1.5,
    isClubOnly: true,
    action: "browser",
    pdfUrl: RECIPES_YANDEX_URL,
  },
  {
    id: "peterburg",
    title: "Гид по Петербургу",
    coverUrl: PETERBURG_COVER_URL,
    coverAspectRatio: 0.72,
    isClubOnly: true,
    action: "browser",
    pdfUrl: PETERBURG_YANDEX_URL,
  },
  {
    id: "loshadka",
    title: "Выкройка лошадка-качалка",
    coverUrl: LOSHADKA_COVER_URL,
    coverAspectRatio: 1176 / 1500,
    isClubOnly: false,
    action: "browser",
    pdfUrl: LOSHADKA_YANDEX_URL,
  },
  {
    id: "patterns",
    title: "Зимние выкройки'26",
    coverUrl: PATTERNS_COVER_URL,
    coverAspectRatio: 1.5,
    isClubOnly: true,
    action: "navigate",
    route: "/library/patterns",
  },
];

const screenWidth = Dimensions.get("window").width;
const GRID_GAP = 12;
const HORIZONTAL_PADDING = 16;
const COLUMN_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;
const CARD_META_HEIGHT = 78;

function splitMasonryColumns(items: MaterialItem[], aspectFor: (item: MaterialItem) => number) {
  const left: MaterialItem[] = [];
  const right: MaterialItem[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  for (const item of items) {
    const aspect = aspectFor(item);
    const imageHeight = COLUMN_WIDTH / Math.max(aspect, 0.35);
    const blockHeight = imageHeight + CARD_META_HEIGHT;
    if (leftHeight <= rightHeight) {
      left.push(item);
      leftHeight += blockHeight + GRID_GAP;
    } else {
      right.push(item);
      rightHeight += blockHeight + GRID_GAP;
    }
  }

  return { left, right };
}

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [coverAspects, setCoverAspects] = useState<Record<string, number>>({});
  const { isSubscribed } = useClub();
  const articlesQuery = trpc.articles.list.useQuery();

  const allMaterials = useMemo(() => {
    const extra: MaterialItem[] = (articlesQuery.data || []).map((article) => ({
      id: `article-${article.id}`,
      title: article.title,
      coverUrl: article.coverUrl || ABOUT_ME_COVER_URL,
      coverAspectRatio: DEFAULT_COVER_ASPECT,
      isClubOnly: true,
      action: "navigate" as const,
      route: `/library/article/${article.id}`,
    }));
    return [...MATERIALS, ...extra];
  }, [articlesQuery.data]);

  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return allMaterials;
    const query = searchQuery.toLowerCase();
    return allMaterials.filter((item) => item.title.toLowerCase().includes(query));
  }, [searchQuery, allMaterials]);

  const handleMaterialPress = async (item: MaterialItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (item.isClubOnly && !isSubscribed) {
      router.push("/(tabs)/club");
      return;
    }

    if (item.action === "navigate" && item.route) {
      router.push(item.route as any);
    } else if (item.action === "browser" && item.pdfUrl) {
      await WebBrowser.openBrowserAsync(item.pdfUrl);
    }
  };

  const getActionLabel = (item: MaterialItem): string => {
    if (item.isClubOnly && !isSubscribed) {
      return "Для участниц клуба Darcy →";
    }
    if (item.action === "browser") return "Скачать →";
    return "Читать →";
  };

  const aspectFor = (item: MaterialItem) =>
    coverAspects[item.id] ?? item.coverAspectRatio ?? DEFAULT_COVER_ASPECT;

  const masonry = useMemo(
    () => splitMasonryColumns(filteredMaterials, aspectFor),
    [filteredMaterials, coverAspects],
  );

  const rememberCoverAspect = (itemId: string, width: number, height: number) => {
    if (!width || !height) return;
    const next = width / height;
    setCoverAspects((prev) => (prev[itemId] === next ? prev : { ...prev, [itemId]: next }));
  };

  const renderCard = (item: MaterialItem) => {
    const aspect = aspectFor(item);
    return (
    <View key={item.id} style={styles.cardWrapper}>
      <Pressable
        onPress={() => handleMaterialPress(item)}
        style={({ pressed }) => [
          styles.card,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Image
          source={{ uri: item.coverUrl }}
          style={[styles.cardImage, { aspectRatio: aspect }]}
          contentFit={item.id === "loshadka" ? "cover" : "contain"}
          contentPosition={item.id === "loshadka" ? "top" : "center"}
          transition={300}
          onLoad={(event) => {
            if (item.id === "loshadka") return;
            const { width, height } = event.source;
            rememberCoverAspect(item.id, width, height);
          }}
        />
      </Pressable>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>

      <TouchableOpacity
        onPress={() => handleMaterialPress(item)}
        activeOpacity={0.7}
        style={[
          styles.actionButton,
          item.isClubOnly && !isSubscribed
            ? styles.actionButtonLocked
            : styles.actionButtonActive,
        ]}
      >
        {item.isClubOnly && !isSubscribed ? (
          <View style={styles.actionButtonContent}>
            <MaterialIcons name="lock" size={12} color={BROWN_MUTED} />
            <Text style={styles.actionButtonLockedText}>
              {getActionLabel(item)}
            </Text>
          </View>
        ) : (
          <View style={styles.actionButtonContent}>
            <MaterialIcons
              name={item.action === "browser" ? "file-download" : "menu-book"}
              size={13}
              color={BROWN}
            />
            <Text style={styles.actionButtonActiveText}>
              {getActionLabel(item)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
    );
  };

  return (
    <ImageBackground
      source={{ uri: PAPER_TEXTURE_URI }}
      resizeMode="cover"
      style={styles.container}
    >
      <TabHeader transparent={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <Image
            source={{ uri: BANNER_URL }}
            style={styles.heroBannerImage}
            contentFit="cover"
          />
          <View style={styles.heroBannerOverlay}>
            <Text style={styles.heroBannerTitle}>БИБЛИОТЕКА</Text>
          </View>
        </View>

        {/* Search bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: "rgba(255,255,255,0.7)", borderColor: colors.border },
          ]}
        >
          <MaterialIcons name="search" size={20} color={BROWN_MUTED} />
          <TextInput
            style={[styles.searchInput, { color: BROWN }]}
            placeholder="Поиск материалов..."
            placeholderTextColor={BROWN_MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="done"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={18} color={BROWN_MUTED} />
            </Pressable>
          )}
        </View>

        {filteredMaterials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={48} color={BROWN_MUTED} />
            <Text style={styles.emptyText}>Ничего не найдено</Text>
          </View>
        ) : (
          <View style={styles.masonry}>
            <View style={styles.masonryColumn}>
              {masonry.left.map((item) => renderCard(item))}
            </View>
            <View style={styles.masonryColumn}>
              {masonry.right.map((item) => renderCard(item))}
            </View>
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroBanner: {
    width: "100%",
    aspectRatio: 2.8,
    position: "relative",
  },
  heroBannerImage: {
    width: "100%",
    height: "100%",
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroBannerTitle: {
    fontSize: 28,
    fontFamily: "EBGaramond-Regular",
    color: "#FDF8F0",
    letterSpacing: 8,
    textTransform: "uppercase",
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: HORIZONTAL_PADDING,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 10 : 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    paddingVertical: 0,
  },
  masonry: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: HORIZONTAL_PADDING,
    marginTop: 12,
    gap: GRID_GAP,
  },
  masonryColumn: {
    flex: 1,
    gap: GRID_GAP,
  },
  cardWrapper: {
    width: "100%",
  },
  card: {
    borderRadius: 4,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    borderRadius: 4,
    backgroundColor: "#EFE6D6",
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    marginTop: 2,
    lineHeight: 18,
  },
  // Action buttons
  actionButton: {
    marginTop: 2,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonActive: {
    backgroundColor: OLIVE_BG,
  },
  actionButtonLocked: {
    backgroundColor: "rgba(228,224,205,0.5)",
    borderWidth: 1,
    borderColor: "rgba(160,132,92,0.2)",
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionButtonActiveText: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    letterSpacing: 0.3,
  },
  actionButtonLockedText: {
    fontSize: 11,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_MUTED,
  },
  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },
});
