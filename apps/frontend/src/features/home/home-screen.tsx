"use client";
import { useViewport } from "@/shared/browser/viewport";
import { useScrollHeader } from "@/shared/browser/use-scroll-header";
import { TabHeader } from "@/shared/ui/tab-header";

import { getHomeScreenLayout } from "./home-screen.layout";
import classes from "./home-screen.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { Background, Action, Typography } from "@/shared/ui/elements";

import { ZoomCard } from "./zoom-card";
import { useState, useEffect } from "react";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
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
} from "@/shared/browser/motion";
import { LinearGradient } from "@/shared/ui/gradient";
import { LegalDocumentsFooter } from "@/features/legal/legal-documents-footer";
import { GardenTourSection } from "@/features/home/garden-tour-video";
import { HomePromoCarousel } from "@/features/home/home-promo-carousel";
import {
  CROSSFADE_DURATION,
  SLIDE_INTERVAL,
  SECTION_BANNERS,
} from "./home-screen.content";
import { getHomeScreenContent } from "./home-screen.content";
type SeasonData = {
  name: string;
  nameRu: string;
  emoji: string;
  heroImages: string[];
};
function getCurrentSeason(month: number): SeasonData {
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
function isSectionNew(
  banner: (typeof SECTION_BANNERS)[number],
  now: number,
): boolean {
  if (!banner.hasNew || !banner.lastUpdated) return false;
  const updated = new Date(banner.lastUpdated).getTime();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  return now - updated <= twoDaysMs;
}
export default function HomeScreen({ initialDate }: { initialDate: string }) {
  const [season, setSeason] = useState(() =>
    getCurrentSeason(new Date(initialDate).getUTCMonth()),
  );
  const [calendarTime, setCalendarTime] = useState(() =>
    new Date(initialDate).getTime(),
  );
  useEffect(() => {
    setSeason(getCurrentSeason(new Date().getMonth()));
    setCalendarTime(Date.now());
  }, [initialDate]);
  const viewport = useViewport();
  const { stylesLayout } = getHomeScreenLayout(viewport);
  const { SCREEN_WIDTH, HERO_HEIGHT } = getHomeScreenContent(viewport);
  const router = useRouter();
  // ── Crossfade slideshow state ──
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useSharedValue(1);
  const nextFadeAnim = useSharedValue(0);
  const [, setNextSlide] = useState(1);
  const slideCount = season.heroImages.length;
  useEffect(() => {
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      if (document.hidden) return;
      setNextSlide(() => (currentSlide + 1) % slideCount);
      fadeAnim.value = withTiming(0, {
        duration: CROSSFADE_DURATION,
        easing: Easing.inOut(Easing.cubic),
      });
      nextFadeAnim.value = withTiming(
        1,
        { duration: CROSSFADE_DURATION, easing: Easing.inOut(Easing.cubic) },
        () => {},
      );
      transitionTimer = setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % slideCount);
        fadeAnim.value = 1;
        nextFadeAnim.value = 0;
        setNextSlide(() => (currentSlide + 2) % slideCount);
      }, CROSSFADE_DURATION + 50);
    }, SLIDE_INTERVAL);
    return () => {
      clearInterval(interval);
      clearTimeout(transitionTimer);
    };
  }, [currentSlide, slideCount, fadeAnim, nextFadeAnim]);
  const currentSlideStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));
  const nextSlideStyle = useAnimatedStyle(() => ({
    opacity: nextFadeAnim.value,
  }));
  // ── Scroll ──
  const scrollY = useSharedValue(0);
  const { headerRef, onScroll: onHeaderScroll } = useScrollHeader();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      onHeaderScroll(event);
      scrollY.value = event.currentTarget.scrollTop;
    },
  });
  // ── Entrance animations ──
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(20);
  useEffect(() => {
    heroOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
    heroTranslateY.value = withDelay(
      300,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [heroOpacity, heroTranslateY]);
  const heroTextStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: cssTransform([{ translateY: heroTranslateY.value }]),
  }));
  // ── Badge pulse glow animation ──
  const badgePulse = useSharedValue(1);
  useEffect(() => {
    badgePulse.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [badgePulse]);
  const newBadgePulseStyle = useAnimatedStyle(() => ({
    opacity: badgePulse.value,
  }));
  // ── Parallax animated styles ──
  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
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
    ]),
  }));
  const welcomeParallaxStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      {
        translateY: interpolate(
          scrollY.value,
          [0, HERO_HEIGHT + 200],
          [0, -20],
          Extrapolation.CLAMP,
        ),
      },
    ]),
  }));
  // ── Medallion glint effect (oval-clipped sweeping gradient) ──
  const MEDALLION_SIZE = SCREEN_WIDTH * 0.55;
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
      [
        HERO_HEIGHT * 0.2,
        HERO_HEIGHT * 0.5,
        HERO_HEIGHT + 100,
        HERO_HEIGHT + 300,
      ],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: cssTransform([
        { translateX: glintTranslate },
        { rotate: "25deg" },
      ]),
      opacity: glintOpacity,
    };
  });
  const aboutParallaxStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT * 0.5, HERO_HEIGHT + 400],
          [20, -15],
          Extrapolation.CLAMP,
        ),
      },
    ]),
  }));
  const bookParallaxStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 100, HERO_HEIGHT + 600],
          [30, -10],
          Extrapolation.CLAMP,
        ),
      },
    ]),
  }));
  const stampParallaxStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
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
    ]),
  }));
  const exploreParallaxStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 600, HERO_HEIGHT + 1200],
          [20, -10],
          Extrapolation.CLAMP,
        ),
      },
    ]),
  }));
  // ── Fade-in animation for ИССЛЕДУЙТЕ title on scroll (smooth, bigger rise) ──
  const exploreTitleFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_HEIGHT + 450, HERO_HEIGHT + 800],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: cssTransform([
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 450, HERO_HEIGHT + 800],
          [24, 0],
          Extrapolation.CLAMP,
        ),
      },
    ]),
  }));
  // ── Parallax effect on cover images (subtle vertical shift as user scrolls) ──
  const feedParallaxImageStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      {
        scale: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 600, HERO_HEIGHT + 1400],
          [1.0, 1.06],
          Extrapolation.CLAMP,
        ),
      },
    ]),
  }));
  const bannerParallaxImageStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      {
        scale: interpolate(
          scrollY.value,
          [HERO_HEIGHT + 900, HERO_HEIGHT + 2200],
          [1.0, 1.05],
          Extrapolation.CLAMP,
        ),
      },
    ]),
  }));
  // ── Render ──
  const paperTextureUri =
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
  return (
    <div className="ui-stack ">
      <Background
        source={{ uri: paperTextureUri }}
        fit="cover"
        className={classes.background}
      >
        <TabHeader ref={headerRef} variant="home" />
        <Animated.ScrollArea
          aria-label="Главная"
          hideScrollbar
          onScroll={scrollHandler}
          contentClassName={classes.scrollAreacontent}
        >
          {/* ═══════════════════════════════════════════
SECTION 1: HERO HEADER — full-width image
with DARYADARCY logo overlay
═══════════════════════════════════════════ */}
          <Animated.div
            style={[
              { height: stylesLayout.slideshowHeroContainer.height },
              heroParallaxStyle,
            ]}
            className={classes.div2}
          >
            {/* Current slide */}
            <Animated.div style={currentSlideStyle} className={classes.div3}>
              <Picture
                source={{ uri: "/assets/images/home/hero_header.jpg" }}
                contentFit="cover"
                transition={0}
                className={classes.div3}
              />
            </Animated.div>
            {/* Next slide (crossfade — seasonal images) */}
            <Animated.div style={nextSlideStyle} className={classes.div3}>
              <Picture
                source={{ uri: "/assets/images/home/hero_header.jpg" }}
                contentFit="cover"
                transition={0}
                className={classes.div3}
              />
            </Animated.div>
            {/* Subtle overlay for depth */}
            <div
              className={["ui-stack ", classes.slideshowOverlay]
                .filter(Boolean)
                .join(" ")}
            />
            {/* DARYADARCY text overlay — positioned in upper third on meadow */}
            <Animated.div style={heroTextStyle} className={classes.div4}>
              <Typography className={classes.slideshowTitle}>
                DARYADARCY
              </Typography>
            </Animated.div>
          </Animated.div>

          {/* ═══════════════════════════════════════════
SECTION 2: WELCOME
"Добро пожаловать" + "в пространство вдохновения" + "для тех кто..."
═══════════════════════════════════════════ */}
          <Animated.div
            entering={FadeIn.delay(400).duration(700)}
            style={[welcomeParallaxStyle, { zIndex: 0 }]}
          >
            <div
              className={["ui-stack ", classes.welcomeSection]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.welcomeTitle}>
                – ДОБРО ПОЖАЛОВАТЬ –
              </Typography>
              <Typography className={classes.welcomeSubheading}>
                пространство
              </Typography>
              <Typography className={classes.welcomeSubheadingLine2}>
                вдохновения
              </Typography>
              <div
                className={["ui-stack ", classes.welcomeRow]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={["ui-stack ", classes.welcomeTextBlock]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.welcomeBody}>
                    для тех, кто мечтает вести
                  </Typography>
                  <Typography className={classes.welcomeBodyItalic}>
                    жизнь
                  </Typography>
                  <Typography className={classes.welcomeBody}>
                    удивительной
                  </Typography>
                  <Typography className={classes.welcomeBodyItalic}>
                    красоты и глубины
                  </Typography>
                </div>
              </div>
            </div>
          </Animated.div>

          {/* ═══════════════════════════════════════════
SECTION 3: ABOUT AUTHOR
Blurred floral background, Gogol font for name
Medallion overlaps from above onto this section
═══════════════════════════════════════════ */}
          <Animated.div
            entering={FadeInDown.delay(600)
              .duration(700)
              .springify()
              .damping(18)}
            style={[aboutParallaxStyle, { zIndex: 1 }]}
          >
            {/* Medallion overlapping from welcome into about */}
            <div
              style={{
                top: stylesLayout.medallionOverlapContainer.top,
                width: stylesLayout.medallionOverlapContainer.width,
                height: stylesLayout.medallionOverlapContainer.height,
              }}
              className={["ui-stack ", classes.medallionOverlapContainer]
                .filter(Boolean)
                .join(" ")}
            >
              <Picture
                source={{ uri: "/assets/images/home/medallion_temp.webp" }}
                contentFit="contain"
                className={classes.medallionOverlapImage}
              />
              {/* Scroll-driven sweeping glint — clipped to two oval locket halves */}
              {/* Left oval half */}
              <div
                className={["ui-stack ", classes.glintOvalLeft]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Animated.div
                  style={[
                    { width: stylesLayout.glintStripe.width },
                    medallionGlintStyle,
                  ]}
                  className={classes.div5}
                >
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
                    className={classes.div3}
                  />
                </Animated.div>
              </div>
              {/* Right oval half */}
              <div
                className={["ui-stack ", classes.glintOvalRight]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Animated.div
                  style={[
                    { width: stylesLayout.glintStripe.width },
                    medallionGlintStyle,
                  ]}
                  className={classes.div5}
                >
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
                    className={classes.div3}
                  />
                </Animated.div>
              </div>
            </div>
            <div
              className={["ui-stack ", classes.aboutSection]
                .filter(Boolean)
                .join(" ")}
            >
              <Picture
                source={{ uri: "/assets/images/home/about_author_bg.jpg" }}
                contentFit="cover"
                className={classes.aboutBgImage}
              />
              {/* Semi-transparent overlay for readability */}
              <div
                className={["ui-stack ", classes.aboutOverlay]
                  .filter(Boolean)
                  .join(" ")}
              />
              <div
                className={["ui-stack ", classes.aboutContent]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.aboutLabel}>
                  – ОБ АВТОРЕ –
                </Typography>
                <Typography className={classes.aboutName}>
                  Дарья Левина–
                </Typography>
                <Typography className={classes.aboutDescription}>
                  cottagecore-блогер,{"\n"}автор &quot;Книги вдохновения&quot;, &quot;Романтика
                  дачи&quot;{"\n"}и &quot;Тропинка к творчеству&quot;.{"\n"}Хозяйка сказочного
                  лесного дома и сада с{"\n"}английскими розами.
                </Typography>
                <Action
                  onClick={() => router.push("/library/about-me")}
                  className={({ pressed }) =>
                    [classes.action2, pressed ? classes.opacityState5 : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Typography className={classes.learnMoreText}>
                    Узнать больше →
                  </Typography>
                </Action>
              </div>
            </div>
          </Animated.div>

          <HomePromoCarousel />

          {/* ═══════════════════════════════════════════
SECTION 4: BOOK WITH QUOTE
Open book on cream background with cottage illustration
═══════════════════════════════════════════ */}
          <Animated.div
            entering={FadeInUp.delay(800).duration(700)}
            style={bookParallaxStyle}
          >
            <ZoomCard route="/shop" className={classes.bookSection}>
              <div
                style={{
                  width: stylesLayout.bookImageContainer.width,
                  marginLeft: stylesLayout.bookImageContainer.marginLeft,
                }}
                className={["ui-stack ", classes.bookImageContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Picture
                  source={{ uri: "/assets/images/home/book_olive.webp" }}
                  contentFit="contain"
                  className={classes.medallionOverlapImage}
                />
                {/* Quote text overlay on the RIGHT page of the book */}
                <div
                  className={["ui-stack ", classes.bookTextOverlay]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.bookQuote}>
                    «Все великие дела тесно{"\n"}переплетаются с маленькими»
                  </Typography>
                  <Typography className={classes.bookAuthor}>
                    Люси Мод Монтгомери{"\n"}&quot;Энн из Зелёных крыш&quot;
                  </Typography>
                  <Picture
                    source={{
                      uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3f69fb85d89c-nbShGAsyJAWYwcXH.webp",
                    }}
                    contentFit="contain"
                    className={classes.cottageIllustration}
                  />
                  <Typography className={classes.bookHint}>
                    Мои книги →
                  </Typography>
                </div>
              </div>
            </ZoomCard>
          </Animated.div>

          {/* ═══════════════════════════════════════════
SECTION 5: STAMP COLLAGE
3x3 vintage stamp grid with photos
═══════════════════════════════════════════ */}
          <Animated.div
            entering={FadeIn.delay(1000).duration(700)}
            style={stampParallaxStyle}
          >
            <div
              className={["ui-stack ", classes.stampSection]
                .filter(Boolean)
                .join(" ")}
            >
              <Picture
                source={{
                  uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5c000c389c50-FumaYiYPevouyHwe.webp",
                }}
                style={{ width: stylesLayout.stampImage.width }}
                contentFit="contain"
                className={classes.stampImage}
              />
            </div>
          </Animated.div>

          {/* ═══════════════════════════════════════════
SECTION 6: EXPLORE — "Исследуйте"
Section title + Feed preview card
═══════════════════════════════════════════ */}
          <Animated.div
            entering={FadeInUp.delay(1200).duration(600)}
            style={exploreParallaxStyle}
          >
            <div
              className={["ui-stack ", classes.exploreSection]
                .filter(Boolean)
                .join(" ")}
            >
              <Animated.Typography
                style={exploreTitleFadeStyle}
                className={classes.typography}
              >
                – ИССЛЕДУЙТЕ –
              </Animated.Typography>

              {/* Feed preview card with parallax image + zoom-in on press */}
              <ZoomCard
                route={SECTION_BANNERS[0].route}
                className={classes.feedCard}
              >
                <div
                  className={["ui-stack ", classes.feedCardImageWrapper]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Animated.div
                    style={feedParallaxImageStyle}
                    className={classes.medallionOverlapImage}
                  >
                    <Picture
                      source={{ uri: SECTION_BANNERS[0].image }}
                      contentFit="cover"
                      className={classes.medallionOverlapImage}
                    />
                  </Animated.div>
                  {isSectionNew(SECTION_BANNERS[0], calendarTime) && (
                    <Animated.div
                      entering={FadeIn.delay(300).duration(400)}
                      style={newBadgePulseStyle}
                      className={classes.div6}
                    >
                      <Typography className={classes.newBadgeText}>
                        НОВОЕ
                        {SECTION_BANNERS[0].newCount > 0
                          ? ` · ${SECTION_BANNERS[0].newCount}`
                          : ""}
                      </Typography>
                    </Animated.div>
                  )}
                </div>
                <div
                  className={["ui-stack ", classes.feedCardTextArea]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.feedCardSubtitle}>
                    Блог о загородной жизни, винтажном стиле и вдохновении
                  </Typography>
                </div>
                <div
                  className={["ui-stack ", classes.feedCardArrow]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.feedCardArrowText}>
                    →
                  </Typography>
                </div>
              </ZoomCard>
            </div>
          </Animated.div>

          {/* ═══════════════════════════════════════════
SECTION 7: SECTION BANNERS (postcard cards)
Kept for navigation to all sections
═══════════════════════════════════════════ */}
          <Animated.div
            entering={FadeInUp.delay(1400).duration(600)}
            className={classes.div7}
          >
            <div
              className={["ui-stack ", classes.bannersSection]
                .filter(Boolean)
                .join(" ")}
            >
              {SECTION_BANNERS.slice(1).map((banner, index) => {
                const isEven = index % 2 === 0;
                return (
                  <Animated.div
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
                    <ZoomCard
                      route={banner.route}
                      className={classes.postcardOuter}
                    >
                      <div
                        className={["ui-stack ", classes.postcardBody]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div
                          className={["ui-stack ", classes.postcardImageArea]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <Animated.div
                            style={bannerParallaxImageStyle}
                            className={classes.medallionOverlapImage}
                          >
                            <Picture
                              source={{ uri: banner.image }}
                              contentFit="cover"
                              className={classes.medallionOverlapImage}
                            />
                          </Animated.div>
                          <div
                            className={[
                              "ui-stack ",
                              classes.postcardImageOverlay,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          />
                          {isSectionNew(banner, calendarTime) && (
                            <Animated.div
                              entering={FadeIn.delay(300).duration(400)}
                              style={newBadgePulseStyle}
                              className={classes.div6}
                            >
                              <Typography className={classes.newBadgeText}>
                                НОВОЕ
                                {banner.newCount > 0
                                  ? ` · ${banner.newCount}`
                                  : ""}
                              </Typography>
                            </Animated.div>
                          )}
                        </div>
                        <div
                          className={["ui-stack ", classes.postcardTextArea]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <Typography className={classes.postcardSubtitle}>
                            {banner.subtitle}
                          </Typography>
                          <Typography className={classes.postcardArrow}>
                            →
                          </Typography>
                        </div>
                      </div>
                    </ZoomCard>
                  </Animated.div>
                );
              })}
            </div>
          </Animated.div>

          <GardenTourSection
            scrollY={scrollY}
            viewportHeight={viewport.height}
          />

          <Animated.div entering={FadeIn.delay(2200).duration(500)}>
            <div
              className={["ui-stack ", classes.footer]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={["ui-stack ", classes.dividerContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={["ui-stack ", classes.dividerLine]
                    .filter(Boolean)
                    .join(" ")}
                />
                <Typography className={classes.dividerLeaf}>✿</Typography>
                <div
                  className={["ui-stack ", classes.dividerLine]
                    .filter(Boolean)
                    .join(" ")}
                />
              </div>
              <Typography className={classes.footerText}>
                slow living & vintage aesthetic
              </Typography>
              <LegalDocumentsFooter className={classes.legalDocumentsFooter} />
            </div>
          </Animated.div>
        </Animated.ScrollArea>
      </Background>
    </div>
  );
}
