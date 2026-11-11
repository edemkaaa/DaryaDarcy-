// Архив Expo. Архивный экран четырёх выкроек использует публичные URI и UI-gate; действующий защищённый API Библиотеки реализован в новом frontend.
import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { ScreenContainer } from "@/components/screen-container";
import { useClub } from "@/lib/club-context";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Colors
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const BROWN_LIGHT = "#A0845C";
const CREAM = "#FDF8F0";
const OLIVE_BG = "#e4e0cd";

// Pattern images from S3
const PATTERNS_HERO_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg";

interface PatternItem {
  id: string;
  title: string;
  imageUrl: string;
  description: string;
}

const CHRISTMAS_PATTERNS: PatternItem[] = [
  {
    id: "holly",
    title: "Остролист",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/18c14e47537e-EJllmcoOmdUexPyK.jpg",
    description: "Лист × 4, ягодка × 3",
  },
  {
    id: "sock",
    title: "Носок",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/958b97c139fc-kvcsayGSgtVcnjGN.jpg",
    description: "Носок × 4, квадрат × 2",
  },
  {
    id: "star",
    title: "Звезда",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ded750bddbeb-HSvrSZijpbSHOLAN.jpg",
    description: "Звезда × 1, ромб × 5",
  },
  {
    id: "apple",
    title: "Яблоко",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9b32f7b0c8f1-ReabYqEbymjBrDEY.jpg",
    description: "Яблоко × 1, лист × 2",
  },
];

const LOSHADKA_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f8a919017d4c-WDRmWxjeWyXWNrto.webp";
const LOSHADKA_YANDEX_URL = "https://disk.yandex.ru/i/nDfsd5ptLO1xRA";

export default function PatternsScreen() {
  // Архивный экран четырёх выкроек использует публичные URI и UI-gate; действующий защищённый API Библиотеки реализован в новом frontend.

  const insets = useSafeAreaInsets();
  const { isSubscribed } = useClub();

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleBack = () => {
    // Возвращает в Библиотеку с native haptic.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleClubCTA = () => {
    // Открывает страницу подписки Клуба.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/(tabs)/club");
  };

  const handleQuizCTA = () => {
    // Исторически ведёт на главную приложения по CTA определения эстетики.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/(tabs)");
  };

  const openPattern = (pattern: PatternItem) => {
    // Запоминает URI/название выкройки и открывает viewer.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setViewerImage(pattern.imageUrl);
    setViewerTitle(pattern.title);
    setViewerVisible(true);
  };

  const handleDownload = useCallback(async () => {
    // На web открывает исходный URI, на native скачивает копию и сохраняет в галерею после разрешения; оригинал не меняет.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // On web, open image in new tab for download
    if (Platform.OS === "web") {
      window.open(viewerImage, "_blank");
      return;
    }

    setDownloading(true);
    try {
      // Dynamic imports for native-only modules
      const FS = require("expo-file-system/legacy") as typeof import("expo-file-system");
      const ML = require("expo-media-library") as typeof import("expo-media-library");

      // Request permissions
      const { status } = await ML.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Нет доступа",
          "Разрешите доступ к галерее, чтобы сохранить выкройку"
        );
        setDownloading(false);
        return;
      }

      // Download to cache
      const filename = viewerImage.split("/").pop() || "pattern.jpg";
      const localUri = (FS as any).cacheDirectory + filename;
      const { uri } = await (FS as any).downloadAsync(viewerImage, localUri);

      // Save to gallery
      await ML.createAssetAsync(uri);
      Alert.alert("Сохранено!", "Выкройка сохранена в галерею");
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Ошибка", "Не удалось сохранить выкройку");
    } finally {
      setDownloading(false);
    }
  }, [viewerImage]);

  const handleOpenLoshadka = async () => {
    // Открывает исходный бесплатный PDF во встроенном browser.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await WebBrowser.openBrowserAsync(LOSHADKA_YANDEX_URL);
  };

  const closeViewer = () => {
    // Закрывает preview и очищает выбранный URI/название.

    setViewerVisible(false);
    setViewerImage("");
    setViewerTitle("");
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner - photo of finished items */}
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: PATTERNS_HERO_URL }}
            style={styles.bannerImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>ВЫКРОЙКИ</Text>
          </View>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            style={styles.backButtonOverlay}
          >
            <Text style={styles.backButtonOverlayText}>← Назад</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Gate */}
        {!isSubscribed ? (
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedText}>
              привилегия участниц Клуба Darcy
            </Text>
            <TouchableOpacity
              style={styles.ctaButtonOlive}
              onPress={handleClubCTA}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonOliveText}>Вступить в клуб →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleQuizCTA}
              activeOpacity={0.7}
              style={styles.quizLinkContainer}
            >
              <Text style={styles.quizLinkText}>
                Определить свою эстетику →
              </Text>
            </TouchableOpacity>

            {/* Blurred preview of patterns */}
            <View style={styles.blurPreviewWrapper}>
              <View style={styles.blurPreviewContent}>
                <Text style={styles.sectionTitle}>
                  Рождественские игрушки
                </Text>
                <View style={styles.previewGrid}>
                  {CHRISTMAS_PATTERNS.map((p) => (
                    <View key={p.id} style={styles.previewThumb}>
                      <Image
                        source={{ uri: p.imageUrl }}
                        style={styles.previewThumbImage}
                        contentFit="cover"
                      />
                    </View>
                  ))}
                </View>
              </View>
              <BlurView
                intensity={25}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["transparent", "rgba(253,248,240,0.9)"]}
                style={styles.blurFadeGradient}
              />
            </View>
          </View>
        ) : (
          <>
            {/* Christmas Toys Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Рождественские игрушки</Text>
              <Text style={styles.sectionSubtitle}>
                Набор из 4 выкроек для пошива ёлочных игрушек из ткани
              </Text>

              {/* Pattern Grid */}
              <View style={styles.patternGrid}>
                {CHRISTMAS_PATTERNS.map((pattern) => (
                  <TouchableOpacity
                    key={pattern.id}
                    style={styles.patternCard}
                    onPress={() => openPattern(pattern)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: pattern.imageUrl }}
                      style={styles.patternCardImage}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={styles.patternCardInfo}>
                      <Text style={styles.patternCardTitle}>
                        {pattern.title}
                      </Text>
                      <Text style={styles.patternCardDesc}>
                        {pattern.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Лошадка-качалка PDF */}
            <View style={styles.pdfSection}>
              <View style={styles.pdfDivider} />
              <TouchableOpacity
                onPress={handleOpenLoshadka}
                activeOpacity={0.8}
                style={styles.loshadkaCoverContainer}
              >
                <Image
                  source={{ uri: LOSHADKA_COVER_URL }}
                  style={styles.loshadkaCover}
                  contentFit="cover"
                  contentPosition="top"
                  transition={300}
                />
              </TouchableOpacity>
              <Text style={styles.sectionTitle}>Выкройка лошадка-качалка</Text>
              <Text style={styles.sectionSubtitle}>
                Выкройка в формате PDF для печати
              </Text>
              <TouchableOpacity
                style={styles.ctaButtonOlive}
                onPress={handleOpenLoshadka}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaButtonOliveText}>
                  Открыть PDF →
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Full-screen Image Viewer */}
      <FullScreenViewer
        visible={viewerVisible}
        imageUrl={viewerImage}
        title={viewerTitle}
        onClose={closeViewer}
        onDownload={handleDownload}
        downloading={downloading}
      />
      </ImageBackground>
  </ScreenContainer>
  );
}

// Full-screen viewer with pinch-to-zoom and download
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
  // Даёт pinch/pan/double-tap zoom с ограничением 1–4 и отдельным действием скачивания.

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
    doubleTapGesture
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleClose = () => {
    // Сбрасывает все shared значения увеличения перед закрытием viewer.

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={viewerStyles.backdrop}>
        {/* Header */}
        <View style={[viewerStyles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.7}
            style={viewerStyles.closeBtn}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={viewerStyles.headerTitle}>{title}</Text>
          <View style={viewerStyles.headerSpacer} />
        </View>

        {/* Zoomable Image */}
        <View style={viewerStyles.imageContainer}>
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[viewerStyles.imageWrapper, animatedImageStyle]}>
              <Image
                source={{ uri: imageUrl }}
                style={viewerStyles.image}
                contentFit="contain"
                transition={150}
              />
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Download Button */}
        <View
          style={[viewerStyles.footer, { paddingBottom: insets.bottom + 16 }]}
        >
          <TouchableOpacity
            style={viewerStyles.downloadButton}
            onPress={onDownload}
            activeOpacity={0.8}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={BROWN} />
            ) : (
              <>
                <MaterialIcons name="file-download" size={20} color={BROWN} />
                <Text style={viewerStyles.downloadText}>
                  Скачать для печати
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  bannerContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 26,
    fontFamily: "EBGaramond-Regular",
    color: "#FDF8F0",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  backButtonOverlay: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  backButtonOverlayText: {
    fontSize: 15,
    fontFamily: "EBGaramond-Italic",
    color: "#fff",
  },
  // Subscription gate
  lockedContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 20,
  },
  lockedText: {
    fontSize: 17,
    fontFamily: "EBGaramond_400Regular_Italic",
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 24,
  },
  ctaButtonOlive: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: OLIVE_BG,
  },
  ctaButtonOliveText: {
    color: BROWN,
    fontSize: 18,
    fontFamily: "EBGaramond-Regular",
    letterSpacing: 1,
  },
  quizLinkContainer: {
    marginTop: 8,
  },
  quizLinkText: {
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    textDecorationLine: "underline",
  },
  blurPreviewWrapper: {
    width: "100%",
    marginTop: 24,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "30",
  },
  blurPreviewContent: {
    padding: 20,
  },
  blurFadeGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  previewThumb: {
    width: (SCREEN_WIDTH - 48 - 24 - 8) / 2,
    aspectRatio: 0.8,
    borderRadius: 8,
    overflow: "hidden",
  },
  previewThumbImage: {
    width: "100%",
    height: "100%",
  },
  // Subscribed content
  sectionContainer: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    textAlign: "center",
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  patternGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  patternCard: {
    width: (SCREEN_WIDTH - 48 - 12) / 2,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "20",
  },
  patternCardImage: {
    width: "100%",
    aspectRatio: 0.8,
  },
  patternCardInfo: {
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  patternCardTitle: {
    fontSize: 16,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
  },
  patternCardDesc: {
    fontSize: 13,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },
  // PDF section
  pdfSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: "center",
  },
  pdfDivider: {
    height: 1,
    backgroundColor: BROWN_LIGHT + "25",
    width: "100%",
    marginBottom: 24,
    marginTop: 12,
  },
  loshadkaCoverContainer: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  loshadkaCover: {
    width: "100%",
    aspectRatio: 1176 / 1500,
    borderRadius: 12,
    backgroundColor: "#EFE6D6",
  },
});

const viewerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontFamily: "EBGaramond-Regular",
    color: "#fff",
    letterSpacing: 1,
  },
  headerSpacer: {
    width: 40,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: "center",
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: OLIVE_BG,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  downloadText: {
    fontSize: 16,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    letterSpacing: 0.5,
  },
});
