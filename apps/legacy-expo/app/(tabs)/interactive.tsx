// Архив Expo. Показывает публичный вход в тест; карточка своим zIndex закрывает нижние хвосты декоративного плюща.
import { Text, View, ScrollView, StyleSheet, Pressable,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { TabHeader } from "@/components/tab-header";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";

const quizCover = require("@/assets/interactive/quiz-cover.jpg");
const ivyLeft = require("@/assets/interactive/ivy-left.png");
const ivyRight = require("@/assets/interactive/ivy-right.png");
const keyDecor = require("@/assets/interactive/key-decor.png");

export default function InteractiveScreen() {
  // Показывает публичный вход в тест; карточка своим zIndex закрывает нижние хвосты декоративного плюща.

  return (
    <ScreenContainer containerClassName="bg-background">
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      <TabHeader transparent={false} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: key + title + subtitle + ivy */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.headerSection}>
          {/* Key centered on top */}
          <Image
            source={keyDecor}
            style={styles.keyDecor}
            contentFit="contain"
          />
          {/* Title */}
          <Text style={styles.headerTitle}>ИНТЕРАКТИВ</Text>
          {/* Subtitle */}
          <Text style={styles.headerSubtitle}>тесты, игры, творческие задания</Text>

          {/* Ivy branches - absolute, visible here, tails extend below */}
          <Image
            source={ivyRight}
            style={styles.ivyLeft}
            contentFit="contain"
          />
          <Image
            source={ivyLeft}
            style={styles.ivyRight}
            contentFit="contain"
          />
        </Animated.View>

        {/* Cards - elevated zIndex so they cover ivy tails */}
        <View style={styles.cardsContainer}>
          {/* Card 1: Тест-путешествие */}
          <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.card}>
            <Pressable
              onPress={() => router.push("/quiz" as any)}
              style={({ pressed }) => [
                styles.cardImageContainer,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Image
                source={quizCover}
                style={styles.cardImage}
                contentFit="cover"
              />
              {/* Icon + Title on bottom-left */}
              <View style={styles.cardBottomLeft}>
                <MaterialIcons name="auto-stories" size={20} color="#FFFFFF" />
                <Text style={styles.cardTitle}>ТЕСТ-ПУТЕШЕСТВИЕ</Text>
              </View>
              {/* Button on bottom-right */}
              <View style={styles.cardBottomRight}>
                <View style={styles.cardButton}>
                  <Text style={styles.cardButtonText}>Начать →</Text>
                </View>
              </View>
            </Pressable>
            {/* Description below image */}
            <View style={styles.cardDescriptionContainer}>
              <Text style={styles.cardDescription}>
                Узнай свою эстетику через атмосферное путешествие по сказочным мирам
              </Text>
            </View>
          </Animated.View>

        </View>
      </ScrollView>
      </ImageBackground>
  </ScreenContainer>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 4,
    marginTop: -18,
    position: "relative",
    overflow: "visible",
    zIndex: 0,
  },
  keyDecor: {
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
    fontFamily: "EBGaramond-Italic",
    fontSize: 15.5,
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 0,
    zIndex: 3,
  },
  ivyLeft: {
    position: "absolute",
    left: -20,
    top: 18,
    width: 140,
    height: 180,
    zIndex: 1,
  },
  ivyRight: {
    position: "absolute",
    right: -20,
    top: 18,
    width: 140,
    height: 180,
    zIndex: 1,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 24,
    marginTop: 30,
    position: "relative",
    zIndex: 2,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: CREAM,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    height: 180,
    position: "relative",
    overflow: "hidden",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardBottomLeft: {
    position: "absolute",
    bottom: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontFamily: "EBGaramond-Bold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 1.5,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardBottomRight: {
    position: "absolute",
    bottom: 14,
    right: 14,
  },
  cardButton: {
    backgroundColor: "rgba(253,248,240,0.93)",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
  },
  cardButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN,
  },
  cardButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  cardButtonTextDisabled: {
    color: BROWN_MUTED,
  },
  cardDescriptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CREAM,
  },
  cardDescription: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    color: BROWN_MUTED,
    lineHeight: 20,
  },
});
