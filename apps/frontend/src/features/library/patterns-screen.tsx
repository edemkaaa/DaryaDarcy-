"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getPatternsScreenLayout } from "./patterns-screen.layout";

import classes from "./patterns-screen.module.scss";
import { cssTransform } from "@/shared/ui/css";
import {
  Background,
  ScrollArea,
  Typography,
  Action,
  Dialog,
  Spinner,
} from "@/shared/ui/elements";
import { useState, useCallback } from "react";
import { Picture } from "@/shared/media/image";
import { BlurView } from "@/shared/ui/blur";
import { LinearGradient } from "@/shared/ui/gradient";
import * as WebBrowser from "@/shared/browser/links";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { useClub } from "@/domain/subscription/subscription-context";
import { useRouter } from "@/shared/navigation/router";
import { useSafeAreaInsets } from "@/shared/ui/safe-area";
import { MaterialIcons } from "@/shared/ui/icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "@/shared/browser/motion";
import { Gesture, GestureDetector } from "@/shared/browser/gestures";
import {
  PAPER_TEXTURE_URI,
  BROWN,
  PATTERNS_HERO_URL,
  CHRISTMAS_PATTERNS,
  LOSHADKA_COVER_URL,
  LOSHADKA_YANDEX_URL,
} from "./patterns-screen.content";
import type { PatternItem } from "./patterns-screen.content";
export default function PatternsScreen() {
  const router = useRouter();
  const viewport = useViewport();
  const { stylesLayout } = getPatternsScreenLayout(viewport);
  const { isSubscribed } = useClub();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");
  const [downloading] = useState(false);
  const handleBack = () => {
    router.back();
  };
  const handleClubCTA = () => {
    router.push("/club");
  };
  const handleQuizCTA = () => {
    router.push("");
  };
  const openPattern = (pattern: PatternItem) => {
    setViewerImage(pattern.imageUrl);
    setViewerTitle(pattern.title);
    setViewerVisible(true);
  };
  const handleDownload = useCallback(async () => {
    {
      window.open(viewerImage, "_blank");
      return;
    }
  }, [viewerImage]);
  const handleOpenLoshadka = async () => {
    await WebBrowser.openBrowserAsync(LOSHADKA_YANDEX_URL);
  };
  const closeViewer = () => {
    setViewerVisible(false);
    setViewerImage("");
    setViewerTitle("");
  };
  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea hideScrollbar contentClassName={classes.scrollContent}>
          {/* Hero Banner - photo of finished items */}
          <div
            className={["ui-stack ", classes.bannerContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Picture
              source={{ uri: PATTERNS_HERO_URL }}
              contentFit="cover"
              transition={300}
              className={classes.bannerImage}
            />
            <div
              className={["ui-stack ", classes.bannerOverlay]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.bannerTitle}>ВЫКРОЙКИ</Typography>
            </div>
            <Action
              onClick={handleBack}
              activeOpacity={0.7}
              className={classes.backButtonOverlay}
            >
              <Typography className={classes.backButtonOverlayText}>
                ← Назад
              </Typography>
            </Action>
          </div>

          {/* Subscription Gate */}
          {!isSubscribed ? (
            <div
              className={["ui-stack ", classes.lockedContainer]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.lockedText}>
                привилегия участниц Клуба Darcy
              </Typography>
              <Action
                onClick={handleClubCTA}
                activeOpacity={0.8}
                className={classes.ctaButtonOlive}
              >
                <Typography className={classes.ctaButtonOliveText}>
                  Вступить в клуб →
                </Typography>
              </Action>
              <Action
                onClick={handleQuizCTA}
                activeOpacity={0.7}
                className={classes.quizLinkContainer}
              >
                <Typography className={classes.quizLinkText}>
                  Определить свою эстетику →
                </Typography>
              </Action>

              {/* Blurred preview of patterns */}
              <div
                className={["ui-stack ", classes.blurPreviewWrapper]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={["ui-stack ", classes.blurPreviewContent]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.sectionTitle}>
                    Рождественские игрушки
                  </Typography>
                  <div
                    className={["ui-stack ", classes.previewGrid]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {CHRISTMAS_PATTERNS.map((p) => (
                      <div
                        key={p.id}
                        style={{ width: stylesLayout.previewThumb.width }}
                        className={["ui-stack ", classes.previewThumb]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Picture
                          source={{ uri: p.imageUrl }}
                          contentFit="cover"
                          className={classes.bannerImage}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <BlurView
                  intensity={25}
                  tint="light"
                  className={classes.blurView}
                />
                <LinearGradient
                  colors={["transparent", "rgba(253,248,240,0.9)"]}
                  className={classes.blurFadeGradient}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Christmas Toys Section */}
              <div
                className={["ui-stack ", classes.sectionContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.sectionTitle}>
                  Рождественские игрушки
                </Typography>
                <Typography className={classes.sectionSubtitle}>
                  Набор из 4 выкроек для пошива ёлочных игрушек из ткани
                </Typography>

                {/* Pattern Grid */}
                <div
                  className={["ui-stack ", classes.patternGrid]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {CHRISTMAS_PATTERNS.map((pattern) => (
                    <Action
                      key={pattern.id}
                      style={{ width: stylesLayout.patternCard.width }}
                      onClick={() => openPattern(pattern)}
                      activeOpacity={0.8}
                      className={classes.patternCard}
                    >
                      <Picture
                        source={{ uri: pattern.imageUrl }}
                        contentFit="cover"
                        transition={200}
                        className={classes.patternCardImage}
                      />
                      <div
                        className={["ui-stack ", classes.patternCardInfo]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Typography className={classes.patternCardTitle}>
                          {pattern.title}
                        </Typography>
                        <Typography className={classes.patternCardDesc}>
                          {pattern.description}
                        </Typography>
                      </div>
                    </Action>
                  ))}
                </div>
              </div>

              {/* Лошадка-качалка PDF */}
              <div
                className={["ui-stack ", classes.pdfSection]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={["ui-stack ", classes.pdfDivider]
                    .filter(Boolean)
                    .join(" ")}
                />
                <Action
                  onClick={handleOpenLoshadka}
                  activeOpacity={0.8}
                  className={classes.loshadkaCoverContainer}
                >
                  <Picture
                    source={{ uri: LOSHADKA_COVER_URL }}
                    contentFit="cover"
                    contentPosition="top"
                    transition={300}
                    className={classes.loshadkaCover}
                  />
                </Action>
                <Typography className={classes.sectionTitle}>
                  Выкройка лошадка-качалка
                </Typography>
                <Typography className={classes.sectionSubtitle}>
                  Выкройка в формате PDF для печати
                </Typography>
                <Action
                  onClick={handleOpenLoshadka}
                  activeOpacity={0.8}
                  className={classes.ctaButtonOlive}
                >
                  <Typography className={classes.ctaButtonOliveText}>
                    Открыть PDF →
                  </Typography>
                </Action>
              </div>
            </>
          )}
        </ScrollArea>

        {/* Full-screen Image Viewer */}
        <FullScreenViewer
          visible={viewerVisible}
          imageUrl={viewerImage}
          title={viewerTitle}
          onClose={closeViewer}
          onDownload={handleDownload}
          downloading={downloading}
        />
      </Background>
    </ScreenContainer>
  );
}
interface FullScreenViewerProps {
  visible: boolean;
  imageUrl: string;
  title: string;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}
function FullScreenViewer({
  visible,
  imageUrl,
  title,
  onClose,
  onDownload,
  downloading,
}: FullScreenViewerProps) {
  const viewport = useViewport();
  const { viewerStylesLayout } = getPatternsScreenLayout(viewport);

  const insets = useSafeAreaInsets();
  // Pinch-to-zoom
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 4) {
        scale.value = withTiming(4);
        savedScale.value = 4;
      } else {
        savedScale.value = scale.value;
      }
    });
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      // If zoomed out, reset position
      if (scale.value <= 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture,
  );
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ]),
  }));
  const handleClose = () => {
    // Reset zoom state
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onClose();
  };
  if (!visible) return null;
  return (
    <Dialog open={visible} motion="fade" onClose={handleClose}>
      <div
        className={["ui-stack ", classes.backdrop].filter(Boolean).join(" ")}
      >
        {/* Header */}
        <div
          style={{ paddingTop: insets.top + 10 }}
          className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
        >
          <Action
            onClick={handleClose}
            activeOpacity={0.7}
            className={classes.closeBtn}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </Action>
          <Typography className={classes.headerTitle}>{title}</Typography>
          <div
            className={["ui-stack ", classes.headerSpacer]
              .filter(Boolean)
              .join(" ")}
          />
        </div>

        {/* Zoomable Image */}
        <div
          className={["ui-stack ", classes.imageContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <GestureDetector gesture={composedGesture}>
            <Animated.div
              style={[
                {
                  width: viewerStylesLayout.imageWrapper.width,
                  height: viewerStylesLayout.imageWrapper.height,
                },
                animatedImageStyle,
              ]}
              className={classes.div2}
            >
              <Picture
                source={{ uri: imageUrl }}
                style={{
                  width: viewerStylesLayout.image.width,
                  height: viewerStylesLayout.image.height,
                }}
                contentFit="contain"
                transition={150}
              />
            </Animated.div>
          </GestureDetector>
        </div>

        {/* Download Button */}
        <div
          style={{ paddingBottom: insets.bottom + 16 }}
          className={["ui-stack ", classes.div3].filter(Boolean).join(" ")}
        >
          <Action
            onClick={onDownload}
            activeOpacity={0.8}
            disabled={downloading}
            className={classes.downloadButton}
          >
            {downloading ? (
              <Spinner size="small" color={BROWN} />
            ) : (
              <>
                <MaterialIcons name="file-download" size={20} color={BROWN} />
                <Typography className={classes.downloadText}>
                  Скачать для печати
                </Typography>
              </>
            )}
          </Action>
        </div>
      </div>
    </Dialog>
  );
}
