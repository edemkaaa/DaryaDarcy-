// Архив Expo. Выбирает календарное название сезона; исторически все четыре ветки содержат один набор hero URI.
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  ImageBackground,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useColors } from "@/hooks/use-colors";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInLeft,
  SlideInRight,
  interpolate,
  useAnimatedScrollHandler,
  Extrapolation,
  withRepeat,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { LegalDocumentsFooter } from "@/components/legal-documents-footer";
import { READABLE_ITALIC_FONT } from "@/lib/brand-font";
import { GardenTourSection } from "@/components/garden-tour-video";
import { TabFocusGate } from "@/components/tab-focus-gate";
import { pressableProps } from "@/lib/ios-web-press";
import { HomePromoCarousel } from "@/components/home-promo-carousel";
import { WOOLEN_FONT } from "@/lib/brand-font";
// MaskedView removed — using pre-rendered glint overlay instead
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CROSSFADE_DURATION = 2000;
const SLIDE_INTERVAL = 5000;

// ── Season helper ──
type SeasonData = {
  name: string;
  nameRu: string;
  emoji: string;
  heroImages: string[];
};

function getCurrentSeason(): SeasonData {
  // Выбирает календарное название сезона; исторически все четыре ветки содержат один набор hero URI.

  const month = new Date().getMonth();
  if (month >= 2 && month <= 4)
    return {
      name: "Spring",
      nameRu: "Весна",
      emoji: "🌿",
      heroImages: [
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/43aa6a138c7a-vMZdQbHoxLvCLaHZ.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f6dc8eaf6752-ilmNGaCKWJLSYlVp.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e933a044db55-gMwUitXnrfSEIunK.jpg",
      ],
    };
  if (month >= 5 && month <= 7)
    return {
      name: "Summer",
      nameRu: "Лето",
      emoji: "☀️",
      heroImages: [
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/43aa6a138c7a-vMZdQbHoxLvCLaHZ.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f6dc8eaf6752-ilmNGaCKWJLSYlVp.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e933a044db55-gMwUitXnrfSEIunK.jpg",
      ],
    };
  if (month >= 8 && month <= 10)
    return {
      name: "Autumn",
      nameRu: "Осень",
      emoji: "🍂",
      heroImages: [
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/43aa6a138c7a-vMZdQbHoxLvCLaHZ.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f6dc8eaf6752-ilmNGaCKWJLSYlVp.jpg",
        "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e933a044db55-gMwUitXnrfSEIunK.jpg",
      ],
    };
  return {
    name: "Winter",
    nameRu: "Зима",
    emoji: "❄️",
    heroImages: [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/43aa6a138c7a-vMZdQbHoxLvCLaHZ.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f6dc8eaf6752-ilmNGaCKWJLSYlVp.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e933a044db55-gMwUitXnrfSEIunK.jpg",
    ],
  };
}

const season = getCurrentSeason();

// ── Section content counts (derived from real local data in each screen) ──
// Feed: 8 posts, Club: 5 posts, Interactive: 3 items, Library: 10 items, Shop: 3 books
const SECTION_CONTENT_COUNTS: Record<string, number> = {
  feed: 8,
  club: 5,
  interactive: 3,
  library: 10,
  shop: 3,
};

// ── Real last-updated dates derived from actual content in each section ──
// These correspond to the most recent item date in each section's local data
const SECTION_LAST_UPDATED: Record<string, string> = {
  feed: "2026-04-20",       // Most recent feed post: "Организация кухонной кладовки" - 20 апреля
  club: "2026-04-20",       // Most recent club post: "Письмо апреля" - 20 апреля
  interactive: "2026-04-15", // Interactive items are upcoming (status: "Скоро")
  library: "2026-04-10",    // Library items have no explicit dates, estimated
  shop: "2026-04-05",       // Shop books have no explicit dates, estimated
};

// ── Section banners data (kept for tests) ──
// Order: Лента → Клуб DARCY → Интерактив → Библиотека → Магазин
const SECTION_BANNERS = [
  {
    id: "feed",
    title: "Лента",
    subtitle: "Блог о загородной жизни, винтажном стиле и вдохновении",
    route: "/(tabs)/feed" as const,
    icon: "article" as const,
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/cc53a49e1416-qxGDcExHmMNZuoWc.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.feed,
    newCount: SECTION_CONTENT_COUNTS.feed,
  },
  {
    id: "club",
    title: "Клуб Darcy",
    subtitle: "Камерное сообщество с эксклюзивными материалами",
    route: "/(tabs)/club" as const,
    icon: "star" as const,
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/597ab82580a0-GDVbsOSXBYgogKWH.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.club,
    newCount: SECTION_CONTENT_COUNTS.club,
  },
  {
    id: "interactive",
    title: "Интерактив",
    subtitle: "Тесты, игры, творческие задания",
    route: "/(tabs)/interactive" as const,
    icon: "auto-awesome" as const,
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/6ac128a122fc-aEjJLmnJbZuksHiz.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.interactive,
    newCount: SECTION_CONTENT_COUNTS.interactive,
  },
  {
    id: "library",
    title: "Библиотека",
    subtitle: "Бесплатные материалы: выкройки, сборники, плейлисты",
    route: "/(tabs)/library" as const,
    icon: "menu-book" as const,
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7e8f673737d1-bGwFUQjrxWpTxAMM.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.library,
    newCount: SECTION_CONTENT_COUNTS.library,
  },
  {
    id: "shop",
    title: "Магазин",
    subtitle: "Печатные книги, электронные пособия и другие продукты",
    route: "/(tabs)/shop" as const,
    icon: "shopping-bag" as const,
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8283ecb861ab-BSgzKdVEmubRcHjZ.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.shop,
    newCount: SECTION_CONTENT_COUNTS.shop,
  },
];

// ── Helper: check if section has new content (within 2 days) ──
function isSectionNew(banner: typeof SECTION_BANNERS[number]): boolean {
  // Сравнивает статическую дату раздела с двухсуточным окном; это не серверный счётчик новых публикаций.

  if (!banner.hasNew || !banner.lastUpdated) return false;
  const updated = new Date(banner.lastUpdated).getTime();
  const now = Date.now();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  return (now - updated) <= twoDaysMs;
}

// ── Palette constants ──
const CREAM = "#F5EDE0";
const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_MID = "#6B5B4E";
const BROWN_LIGHT = "#8B7355";
const ACCENT_GREEN = "#8B7355"; // Brown accent (was green)

// ── ZoomCard: Pressable card with zoom-in animation + haptic before navigation ──
function ZoomCard({
  route,
  style,
  children,
}: {
  route: string;
  style?: any;
  children: React.ReactNode;
}) {
  // Проигрывает короткий press-zoom и передаёт переход в JS после завершения UI-анимации.

  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    // Даёт native haptic и запускает анимацию перехода выбранной карточки.

    // Haptic feedback on press
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    scale.value = withTiming(1.03, { duration: 120, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        scale.value = withTiming(1, { duration: 100 });
        runOnJS(navigateToRoute)(route);
      }
    });
  }, [route]);

  function navigateToRoute(r: string) {
    // Открывает внутренний route карточки из JS-потока.

    router.push(r as any);
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        style,
        pressed && { opacity: 0.95 },
      ]}
    >
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  // Архивная главная компонует публичные промо, декоративный параллакс и переходы; данные свежести здесь статичны.

  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Pull-to-refresh state ──
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    // Имитирует обновление только spinner/haptic на 1,2 секунды, не выполняя серверного запроса.

    setRefreshing(true);
    // Simulate refresh (re-check content counts / dates)
    // In a real app this would fetch from API
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, []);

  // ── Crossfade slideshow state ──
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useSharedValue(1);
  const nextFadeAnim = useSharedValue(0);
  const [nextSlide, setNextSlide] = useState(1);
  const slideCount = season.heroImages.length;

  useEffect(() => {
    // Циклически crossfade-переключает индексы hero; cleanup снимает interval, но вложенный timeout отдельно не сохраняется.

    const interval = setInterval(() => {
      setNextSlide(() => (currentSlide + 1) % slideCount);
      fadeAnim.value = withTiming(0, {
        duration: CROSSFADE_DURATION,
        easing: Easing.inOut(Easing.cubic),
      });
      nextFadeAnim.value = withTiming(
        1,
        { duration: CROSSFADE_DURATION, easing: Easing.inOut(Easing.cubic) },
        () => {}
      );
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % slideCount);
        fadeAnim.value = 1;
        nextFadeAnim.value = 0;
        setNextSlide(() => (currentSlide + 2) % slideCount);
      }, CROSSFADE_DURATION + 50);
    }, SLIDE_INTERVAL);
    return () => clearInterval(interval);
  }, [currentSlide, slideCount]);

  // Два opacity-слоя реализуют crossfade; в архивном JSX оба используют один локальный hero-header ресурс.
const currentSlideStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));
  const nextSlideStyle = useAnimatedStyle(() => ({
    opacity: nextFadeAnim.value,
  }));

  // ── Scroll ──
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const scrollY = useSharedValue(0);
  const prevScrollY = useSharedValue(0);
  const headerTranslateY = useSharedValue(0);
  const HEADER_HEIGHT = insets.top + 44;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      // Скрывает header при движении вниз, возвращает при движении вверх и обновляет shared scroll для декора.

      const currentY = event.contentOffset.y;
      const diff = currentY - prevScrollY.value;

      if (currentY <= 0) {
        // At top — always show
        headerTranslateY.value = withTiming(0, { duration: 200 });
      } else if (diff > 3) {
        // Scrolling down — hide
        headerTranslateY.value = withTiming(-HEADER_HEIGHT, { duration: 250 });
      } else if (diff < -3) {
        // Scrolling up — show
        headerTranslateY.value = withTiming(0, { duration: 200 });
      }

      prevScrollY.value = currentY;
      scrollY.value = currentY;
    },
  });

  // Смещение header независимо от scroll-контента позволяет прятать шапку вниз по ленте и возвращать при движении вверх.
const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  // ── Fix: reset scroll position when tab gains focus to prevent header sliding ──
  const isFocused = useIsFocused();
  useEffect(() => {
    // При возвращении фокуса сбрасывает scroll и header, чтобы прошлый параллакс не сдвигал шапку.

    if (isFocused) {
      // Reset the shared value to 0 so parallax header snaps back
      scrollY.value = 0;
      prevScrollY.value = 0;
      headerTranslateY.value = withTiming(0, { duration: 150 });
      // Scroll the view to top
      scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
    }
  }, [isFocused]);

  // ── Entrance animations ──
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(20);

  useEffect(() => {
    // Запускает отложенное появление названия hero с opacity/translate на UI-потоке.

    heroOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
    heroTranslateY.value = withDelay(
      300,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const heroTextStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroTranslateY.value }],
  }));

  // ── Badge pulse glow animation ──
  const badgePulse = useSharedValue(1);
  useEffect(() => {
    // Запускает бесконечную пульсацию меток нового; отдельного cancelAnimation cleanup в архиве нет.

    badgePulse.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);
  const newBadgePulseStyle = useAnimatedStyle(() => ({
    opacity: badgePulse.value,
  }));

  // ── Parallax animated styles ──
  // Hero и welcome двигаются с разной скоростью, а CLAMP удерживает масштаб и смещение в рассчитанных пределах.
const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HERO_HEIGHT],
          [0, HERO_HEIGHT * 0.35],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollY.value,
          [-100, 0],
          [1.15, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const welcomeParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HERO_HEIGHT + 200],
          [0, -20],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Medallion glint effect (oval-clipped sweeping gradient) ──
  const MEDALLION_SIZE = SCREEN_WIDTH * 0.55;
  const GLINT_STRIPE_W = MEDALLION_SIZE * 0.35;
  // Блик скользит через две овальные маски медальона и исчезает вне заданного диапазона прокрутки.
const medallionGlintStyle = useAnimatedStyle(() => {
    // Sweeping gradient stripe moves across the medallion as user scrolls
    const glintTranslate = interpolate(
      scrollY.value,
      [HERO_HEIGHT * 0.2, HERO_HEIGHT + 300],
      [-MEDALLION_SIZE * 0.6, MEDALLION_SIZE * 1.2],
      Extrapolation.CLAMP,
    );
    const glintOpacity = interpolate(
      scrollY.value,
      [HERO_HEIGHT * 0.2, HERO_HEIGHT * 0.5, HERO_HEIGHT + 100, HERO_HEIGHT + 300],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX: glintTranslate }, { rotate: "25deg" }],
      opacity: glintOpacity,
    };
  });

  // Последующие секции получают отдельные короткие диапазоны параллакса, не меняя реальную высоту потока.
const aboutParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT * 0.5, HERO_HEIGHT + 400],
          [20, -15],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const bookParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 100, HERO_HEIGHT + 600],
          [30, -10],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const stampParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 200, HERO_HEIGHT + 900],
          [30, -15],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 200, HERO_HEIGHT + 700],
          [0.94, 1.01],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const exploreParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 600, HERO_HEIGHT + 1200],
          [20, -10],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Fade-in animation for ИССЛЕДУЙТЕ title on scroll (smooth, bigger rise) ──
  // Заголовок разделов появляется от scroll-порога через opacity/translate, без изменения занимаемого места.
const exploreTitleFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_HEIGHT + 450, HERO_HEIGHT + 800],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 450, HERO_HEIGHT + 800],
          [24, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Parallax effect on cover images (subtle vertical shift as user scrolls) ──
  const feedParallaxImageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 600, HERO_HEIGHT + 1400],
          [1.0, 1.06],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const bannerParallaxImageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 900, HERO_HEIGHT + 2200],
          [1.0, 1.05],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Render ──
  const paperTextureUri = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
  return (
    <TabFocusGate>
    <ImageBackground source={{ uri: paperTextureUri }} resizeMode="cover" style={[styles.container, { backgroundColor: CREAM_BG }]}>
      {/* Custom animated header — hides on scroll down, shows on scroll up */}
      <Animated.View style={[styles.customHeader, { paddingTop: insets.top, height: HEADER_HEIGHT }, headerAnimatedStyle]}>
        <Pressable
          {...pressableProps(() => router.navigate("/(tabs)" as any))}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
        >
          <MaterialIcons name="home" size={22} color="rgba(255,255,255,0.9)" />
        </Pressable>
        <Pressable
          {...pressableProps(() => router.push("/(tabs)/profile" as any))}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
        >
          <MaterialIcons name="person-outline" size={22} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </Animated.View>
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BROWN_LIGHT}
            colors={[BROWN_LIGHT, ACCENT_GREEN]}
            progressBackgroundColor={CREAM}
          />
        }
      >
        {/* ═══════════════════════════════════════════
            SECTION 1: HERO HEADER — full-width image
            with DARYADARCY logo overlay
        ═══════════════════════════════════════════ */}
        <Animated.View style={[styles.slideshowHeroContainer, heroParallaxStyle]}>
          {/* Current slide */}
          <Animated.View
            style={[StyleSheet.absoluteFillObject, currentSlideStyle]}
          >
            <Image
              source={require("@/assets/images/home/hero_header.jpg")}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={0}
            />
          </Animated.View>
          {/* Next slide (crossfade — seasonal images) */}
          <Animated.View
            style={[StyleSheet.absoluteFillObject, nextSlideStyle]}
          >
            <Image
              source={require("@/assets/images/home/hero_header.jpg")}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={0}
            />
          </Animated.View>
          {/* Subtle overlay for depth */}
          <View style={styles.slideshowOverlay} />
          {/* DARYADARCY native text overlay — positioned in upper third on meadow */}
          <Animated.View style={[styles.slideshowTitleContainer, heroTextStyle]}>
            <Text style={styles.slideshowTitle}>DARYADARCY</Text>
          </Animated.View>
        </Animated.View>

        {/* ═══════════════════════════════════════════
            SECTION 2: WELCOME
            "Добро пожаловать" + "в пространство вдохновения" + "для тех кто..."
        ═══════════════════════════════════════════ */}
        <Animated.View entering={FadeIn.delay(400).duration(700)} style={[welcomeParallaxStyle, { zIndex: 0 }]}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>– ДОБРО ПОЖАЛОВАТЬ –</Text>
            <Text style={styles.welcomeSubheading}>пространство</Text>
            <Text style={styles.welcomeSubheadingLine2}>вдохновения</Text>
            <View style={styles.welcomeRow}>
              <View style={styles.welcomeTextBlock}>
                <Text style={styles.welcomeBody}>для тех, кто мечтает вести</Text>
                <Text style={styles.welcomeBodyItalic}>жизнь</Text>
                <Text style={styles.welcomeBody}>удивительной</Text>
                <Text style={styles.welcomeBodyItalic}>красоты и глубины</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ═══════════════════════════════════════════
            SECTION 3: ABOUT AUTHOR
            Blurred floral background, Gogol font for name
            Medallion overlaps from above onto this section
        ═══════════════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(700).springify().damping(18)}
          style={[aboutParallaxStyle, { zIndex: 1 }]}
        >
          {/* Medallion overlapping from welcome into about */}
          <View style={styles.medallionOverlapContainer}>
            <Image
              source={require("@/assets/images/home/medallion_temp.webp")}
              style={styles.medallionOverlapImage}
              contentFit="contain"
            />
            {/* Scroll-driven sweeping glint — clipped to two oval locket halves */}
            {/* Left oval half */}
            <View style={styles.glintOvalLeft}>
              <Animated.View style={[styles.glintStripe, medallionGlintStyle]}>
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255,255,255,0.08)",
                    "rgba(255,248,230,0.2)",
                    "rgba(255,255,255,0.05)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </View>
            {/* Right oval half */}
            <View style={styles.glintOvalRight}>
              <Animated.View style={[styles.glintStripe, medallionGlintStyle]}>
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255,255,255,0.05)",
                    "rgba(255,248,230,0.2)",
                    "rgba(255,255,255,0.05)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </View>
          </View>
          <View style={styles.aboutSection}>
            <Image
              source={require("@/assets/images/home/about_author_bg.jpg")}
              style={styles.aboutBgImage}
              contentFit="cover"
            />
            {/* Semi-transparent overlay for readability */}
            <View style={styles.aboutOverlay} />
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>– ОБ АВТОРЕ –</Text>
              <Text style={styles.aboutName}>Дарья Левина–</Text>
              <Text style={styles.aboutDescription}>
                cottagecore-блогер,{"\n"}автор "Книги вдохновения", "Романтика
                дачи"{"\n"}и "Тропинка к творчеству".{"\n"}Хозяйка сказочного
                лесного дома и сада с{"\n"}английскими розами.
              </Text>
              <Pressable
                onPress={() => router.push("/library/about-me")}
                style={({ pressed }) => [
                  styles.learnMoreButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.learnMoreText}>Узнать больше →</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        <HomePromoCarousel />

        {/* ═══════════════════════════════════════════
            SECTION 4: BOOK WITH QUOTE
            Open book on cream background with cottage illustration
        ═══════════════════════════════════════════ */}
        <Animated.View entering={FadeInUp.delay(800).duration(700)} style={bookParallaxStyle}>
          <ZoomCard route="/(tabs)/shop" style={styles.bookSection}>
            <View style={styles.bookImageContainer}>
              <Image
                source={require("@/assets/images/home/book_olive.webp")}
                style={styles.bookImage}
                contentFit="contain"
              />
              {/* Quote text overlay on the RIGHT page of the book */}
              <View style={styles.bookTextOverlay}>
                <Text style={styles.bookQuote}>
                  «Все великие дела тесно{"\n"}переплетаются с маленькими»
                </Text>
                <Text style={styles.bookAuthor}>
                  Люси Мод Монтгомери{"\n"}"Энн из Зелёных крыш"
                </Text>
                <Image
                  source={{ uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3f69fb85d89c-nbShGAsyJAWYwcXH.webp" }}
                  style={styles.cottageIllustration}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              <Text style={styles.bookHint}>Мои книги →</Text>
              </View>
            </View>
          </ZoomCard>
        </Animated.View>

        {/* ═══════════════════════════════════════════
            SECTION 5: STAMP COLLAGE
            3x3 vintage stamp grid with photos
        ═══════════════════════════════════════════ */}
        <Animated.View entering={FadeIn.delay(1000).duration(700)} style={stampParallaxStyle}>
          <View style={styles.stampSection}>
            <Image
              source={{ uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5c000c389c50-FumaYiYPevouyHwe.webp" }}
              style={styles.stampImage}
              contentFit="contain"
            />
          </View>
        </Animated.View>

        {/* ═══════════════════════════════════════════
            SECTION 6: EXPLORE — "Исследуйте"
            Section title + Feed preview card
        ═══════════════════════════════════════════ */}
        <Animated.View entering={FadeInUp.delay(1200).duration(600)} style={exploreParallaxStyle}>
          <View style={styles.exploreSection}>
            <Animated.Text style={[styles.exploreTitle, exploreTitleFadeStyle]}>– ИССЛЕДУЙТЕ –</Animated.Text>

            {/* Feed preview card with parallax image + zoom-in on press */}
            <ZoomCard route={SECTION_BANNERS[0].route} style={styles.feedCard}>
              <View style={styles.feedCardImageWrapper}>
                <Animated.View style={[styles.feedCardParallaxInner, feedParallaxImageStyle]}>
                  <Image
                    source={{ uri: SECTION_BANNERS[0].image }}
                    style={styles.feedCardImage}
                    contentFit="cover"
                  />
                </Animated.View>
                {isSectionNew(SECTION_BANNERS[0]) && (
                  <Animated.View
                    entering={FadeIn.delay(300).duration(400)}
                    style={[styles.newBadge, newBadgePulseStyle]}
                  >
                    <Text style={styles.newBadgeText}>
                      НОВОЕ{SECTION_BANNERS[0].newCount > 0 ? ` · ${SECTION_BANNERS[0].newCount}` : ""}
                    </Text>
                  </Animated.View>
                )}
              </View>
              <View style={styles.feedCardTextArea}>
                <Text style={styles.feedCardSubtitle}>
                  Блог о загородной жизни, винтажном стиле и вдохновении
                </Text>
              </View>
              <View style={styles.feedCardArrow}>
                <Text style={styles.feedCardArrowText}>→</Text>
              </View>
            </ZoomCard>
          </View>
        </Animated.View>

        {/* ═══════════════════════════════════════════
            SECTION 7: SECTION BANNERS (postcard cards)
            Kept for navigation to all sections
        ═══════════════════════════════════════════ */}
        <Animated.View entering={FadeInUp.delay(1400).duration(600)} style={{ zIndex: 3 }}>
          <View style={styles.bannersSection}>
            {SECTION_BANNERS.slice(1).map((banner, index) => {
              const isEven = index % 2 === 0;
              return (
                <Animated.View
                  key={banner.id}
                  entering={
                    isEven
                      ? SlideInLeft.delay(1600 + index * 150)
                          .duration(500)
                          .springify()
                          .damping(16)
                      : SlideInRight.delay(1600 + index * 150)
                          .duration(500)
                          .springify()
                          .damping(16)
                  }
                >
                  <ZoomCard route={banner.route} style={styles.postcardOuter}>
                    <View style={styles.postcardBody}>
                      <View style={styles.postcardImageArea}>
                        <Animated.View style={[styles.postcardParallaxInner, bannerParallaxImageStyle]}>
                          <Image
                            source={{ uri: banner.image }}
                            style={styles.postcardImage}
                            contentFit="cover"
                          />
                        </Animated.View>
                        <View style={styles.postcardImageOverlay} />
                        {isSectionNew(banner) && (
                          <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={[styles.newBadge, newBadgePulseStyle]}
                          >
                            <Text style={styles.newBadgeText}>
                              НОВОЕ{banner.newCount > 0 ? ` · ${banner.newCount}` : ""}
                            </Text>
                          </Animated.View>
                        )}
                      </View>
                      <View style={styles.postcardTextArea}>

                        <Text style={styles.postcardSubtitle}>
                          {banner.subtitle}
                        </Text>
                        <Text style={styles.postcardArrow}>→</Text>
                      </View>
                    </View>
                  </ZoomCard>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        <GardenTourSection scrollY={scrollY} viewportHeight={Dimensions.get("window").height} />

        <Animated.View entering={FadeIn.delay(2200).duration(500)}>
          <View style={styles.footer}>
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLeaf}>✿</Text>
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.footerText}>
              slow living & vintage aesthetic
            </Text>
            <LegalDocumentsFooter style={{ paddingTop: 8 }} />
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </ImageBackground>
    </TabFocusGate>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const HERO_ASPECT = 1152 / 2048; // hero_header.jpg aspect (16:9)
const HERO_HEIGHT = SCREEN_WIDTH * 0.6;

// Слои главной используют фиксированную геометрию иллюстраций: overlay-header выше hero, овальные маски ограничивают блик медальона.
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Custom Header (animated, absolutely positioned, transparent on banner) ──
  customHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  // ── SECTION 1: Hero Header ──
  slideshowHeroContainer: {
    width: "100%",
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: "#2D3A2E",
    zIndex: 2,
    overflow: "hidden",
  },
  slideshowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 45, 30, 0.08)",
    zIndex: 1,
  },
  slideshowTitleContainer: {
    position: "absolute",
    top: "15%",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  slideshowTitle: {
    fontSize: 48,
    color: "#FFF8F0",
    fontFamily: WOOLEN_FONT,
    textAlign: "center",
    letterSpacing: 3,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // ── SECTION 2: Welcome ──
  welcomeSection: {
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 24,
    alignItems: "center",
    zIndex: 0,
  },
  welcomeTitle: {
    fontSize: 17,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: 8,
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  welcomeTextBlock: {
    width: "50%",
    alignSelf: "flex-start",
    marginLeft: -4,
  },
  welcomeSubheading: {
    fontSize: 24,
    color: BROWN_MID,
    fontFamily: "Gogol-Regular",
    textAlign: "left",
    alignSelf: "flex-start",
    letterSpacing: 0.3,
    marginBottom: -2,
  },
  welcomeSubheadingLine2: {
    fontSize: 24,
    color: BROWN_MID,
    fontFamily: "Gogol-Regular",
    textAlign: "left",
    alignSelf: "flex-start",
    letterSpacing: 0.3,
    marginLeft: 80,
    marginBottom: 4,
  },
  welcomeBody: {
    fontSize: 16,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 1,
  },
  welcomeBodyItalic: {
    fontSize: 16,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Italic",
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  // Medallion overlapping onto about section
  medallionOverlapContainer: {
    position: "absolute",
    top: -SCREEN_WIDTH * 0.35,
    right: 8,
    zIndex: 10,
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
  },
  medallionOverlapImage: {
    width: "100%",
    height: "100%",
  },
  // ── Glint oval clip containers ──
  // Positioned to match the two oval halves of the open locket
  // Image is 600x480, displayed with contentFit="contain" in a square container
  // Image occupies full width, 80% height, centered vertically (10% offset top)
  glintOvalLeft: {
    position: "absolute",
    left: "17%",
    top: "32%",
    width: "34%",
    height: "40%",
    borderRadius: 9999,
    overflow: "hidden",
  },
  glintOvalRight: {
    position: "absolute",
    left: "50%",
    top: "24%",
    width: "34%",
    height: "52%",
    borderRadius: 9999,
    overflow: "hidden",
  },
  glintStripe: {
    position: "absolute",
    top: -60,
    bottom: -60,
    width: SCREEN_WIDTH * 0.55 * 0.35,
    left: 0,
  },

  // ── SECTION 3: About Author ──
  aboutSection: {
    width: "100%",
    aspectRatio: 3 / 2,
    position: "relative",
    overflow: "visible",
    justifyContent: "center",
  },
  aboutBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  aboutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  aboutContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    zIndex: 1,
  },
  aboutLabel: {
    fontSize: 13,
    color: "rgba(240,235,227,0.8)",
    fontFamily: "EBGaramond-Regular",
    letterSpacing: 2,
    marginBottom: 4,
  },
  aboutName: {
    fontSize: 32,
    color: "#F0EBE3",
    fontFamily: "Gogol-Regular",
    marginBottom: 12,
    lineHeight: 42,
  },
  aboutDescription: {
    fontSize: 15,
    color: "rgba(240,235,227,0.9)",
    fontFamily: "EBGaramond-Regular",
    lineHeight: 24,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  learnMoreButton: {
    alignSelf: "center",
    backgroundColor: "rgba(245, 237, 224, 0.85)",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 4,
  },
  learnMoreText: {
    fontSize: 14,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
    letterSpacing: 1,
  },

  // ── SECTION 4: Book with Quote ──
  bookSection: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    alignItems: "flex-start",
    overflow: "hidden",
    marginTop: -8,
  },
  bookImageContainer: {
    width: SCREEN_WIDTH * 1.3,
    aspectRatio: 880 / 586,
    position: "relative",
    marginLeft: -SCREEN_WIDTH * 0.42,
  },
  bookImage: {
    width: "100%",
    height: "100%",
  },
  leftPageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "49%",
    height: "100%",
    transformOrigin: "right center",
    overflow: "hidden",
  },
  leftPageImage: {
    width: "100%",
    height: "100%",
  },
  bookTextOverlay: {
    position: "absolute",
    top: "18%",
    left: "52%",
    right: "10%",
    bottom: "6%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: 0,
    paddingHorizontal: 12,
  },
  bookQuote: {
    fontSize: 14,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
    textAlign: "left",
    lineHeight: 21,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  bookAuthor: {
    fontSize: 11,
    color: BROWN_MID,
    fontFamily: "EBGaramond-Italic",
    textAlign: "right",
    lineHeight: 16,
    alignSelf: "flex-end",
    marginBottom: 2,
  },
  cottageIllustration: {
    width: "110%",
    aspectRatio: 600 / 480,
    alignSelf: "center",
    marginTop: "auto",
    marginBottom: -4,
  },
  bookHint: {
    fontSize: 14,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
    letterSpacing: 1,
    alignSelf: "flex-end",
    marginTop: -2,
    marginBottom: 6,
  },

  // ── SECTION 5: Stamp Collage ──
  stampSection: {
    paddingHorizontal: 6,
    paddingVertical: 0,
    alignItems: "center",
    marginTop: -8,
    marginBottom: -4,
  },
  stampImage: {
    width: SCREEN_WIDTH - 12,
    aspectRatio: 1000 / 732,
  },

  // ── SECTION 6: Explore ──
  exploreSection: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  exploreTitle: {
    fontSize: 17,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: 16,
  },
  feedCard: {
    width: "100%",
    backgroundColor: CREAM_BG,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#4A3728",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: "#D4C4A8",
  },
  feedCardImageWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
  },
  feedCardParallaxInner: {
    width: "100%",
    height: "100%",
  },
  feedCardImage: {
    width: "100%",
    height: "100%",
  },
  feedCardTextArea: {
    padding: 16,
  },
  feedCardTitle: {
    fontSize: 20,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-SemiBold",
    marginBottom: 4,
  },
  feedCardDivider: {
    width: 40,
    height: 1,
    backgroundColor: BROWN_LIGHT,
    marginBottom: 6,
  },
  feedCardSubtitle: {
    fontSize: 16,
    color: BROWN_MID,
    fontFamily: "EBGaramond-Italic",
    lineHeight: 22,
  },
  feedCardArrow: {
    position: "absolute",
    bottom: 16,
    right: 16,
  },
  feedCardArrowText: {
    fontSize: 22,
    color: BROWN_LIGHT,
    fontFamily: "EBGaramond-Regular",
  },

  // ── SECTION 7: Postcard Banners ──
  bannersSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  postcardOuter: {
    marginBottom: 14,
    shadowColor: "#4A3728",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  postcardBody: {
    backgroundColor: CREAM_BG,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#D4C4A8",
  },
  postcardImageArea: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
    overflow: "hidden",
  },
  postcardParallaxInner: {
    width: "100%",
    height: "100%",
  },
  postcardImage: {
    width: "100%",
    height: "100%",
  },
  postcardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(74, 55, 40, 0.08)",
  },
  postcardTextArea: {
    padding: 16,
    paddingTop: 14,
    position: "relative",
  },
  postcardStamp: {
    position: "absolute",
    top: 12,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#C4A882",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  postcardTitle: {
    fontSize: 18,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN_DARK,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  postcardDivider: {
    width: 40,
    height: 1,
    backgroundColor: "#C4A882",
    marginBottom: 6,
  },
  postcardSubtitle: {
    fontSize: 15,
    color: BROWN_LIGHT,
    fontFamily: "EBGaramond-Italic",
    lineHeight: 21,
    letterSpacing: 0.3,
    paddingRight: 40,
  },
  postcardArrow: {
    position: "absolute",
    bottom: 14,
    right: 16,
    fontSize: 22,
    color: BROWN_LIGHT,
    fontFamily: "EBGaramond-Regular",
  },

  // ── SECTION 8: Letter ──
  letterSection: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 16,
    padding: 28,
    backgroundColor: CREAM,
  },
  letterText: {
    fontSize: 18,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_DARK,
    marginBottom: 12,
  },
  letterBody: {
    fontSize: 14,
    lineHeight: 22,
    color: BROWN_MID,
    fontFamily: "EBGaramond-Regular",
    marginBottom: 16,
  },
  letterSignature: {
    fontSize: 15,
    fontFamily: "EBGaramond-Italic",
    textAlign: "right",
    color: BROWN_DARK,
  },

  // ── Footer ──
  footer: {
    paddingVertical: 16,
    paddingBottom: 32,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: READABLE_ITALIC_FONT,
    color: BROWN_LIGHT,
  },

  // ── Divider ──
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 12,
  },
  dividerLine: {
    height: 0.5,
    width: 60,
    opacity: 0.4,
    backgroundColor: BROWN_LIGHT,
  },
  dividerLeaf: {
    fontSize: 14,
    opacity: 0.5,
    color: BROWN_LIGHT,
  },

  // ── "Новое" badge ──
  newBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(74, 55, 40, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: "EBGaramond-SemiBold",
    color: "#FFF8EB",
    letterSpacing: 1,
  },

  // ── Kept for reference: heroContainer style name (tests) ──
  heroContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
});
