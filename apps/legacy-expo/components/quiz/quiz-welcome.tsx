// Архив Expo. Показывает публичное введение в тест, локальный коллаж и старт reducer без запроса к API.
import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useQuiz } from "@/lib/quiz-state";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";

const { width } = Dimensions.get("window");

export function QuizWelcome() {
  // Показывает публичное введение в тест, локальный коллаж и старт reducer без запроса к API.

  const { dispatch } = useQuiz();
  const colors = useColors();

  const handleStart = () => {
    // Переводит общий quiz reducer из welcome к первому вопросу.

    dispatch({ type: "START_QUIZ" });
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back link — above collage, left aligned */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        {/* Floating collage on app background */}
        <View style={styles.collageContainer}>
          <Image
            source={require("@/assets/quiz/start-collage.webp")}
            style={styles.collageImage}
            contentFit="contain"
          />
        </View>

        {/* Title — EB Garamond Bold, brown, caps */}
        <Text style={styles.title}>
          ТЕСТ-ПУТЕШЕСТВИЕ:
        </Text>
        <Text style={styles.subtitle}>
          найди свою эстетику
        </Text>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { color: colors.muted }]}>
            Закрой глаза. Представь: ты лежишь на мягкой траве, сквозь ветви пробивается свет. Просыпаешься, и начинается странствие.
          </Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Семь миров будут открываться перед тобой. Пейзажи, текстуры, существа, артефакты — выбирай то, что зовёт.
          </Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            В конце ты узнаешь свою эстетику — не просто название, а глубокий портрет: к чему тянется твоя душа и как проявлять это в жизни каждый день.
          </Text>

          {/* Info cards */}
          <View style={styles.infoRow}>
            <View style={[styles.infoCard, { backgroundColor: "#e4e0cd" }]}>
              <Text style={[styles.infoNumber, { color: BROWN }]}>10</Text>
              <Text style={[styles.infoLabel, { color: BROWN_MUTED }]}>вопросов</Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: "#e4e0cd" }]}>
              <Text style={[styles.infoNumber, { color: BROWN }]}>7</Text>
              <Text style={[styles.infoLabel, { color: BROWN_MUTED }]}>эстетик</Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: "#e4e0cd" }]}>
              <Text style={[styles.infoNumber, { color: BROWN }]}>5</Text>
              <Text style={[styles.infoLabel, { color: BROWN_MUTED }]}>мин</Text>
            </View>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={handleStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Начать путешествие</Text>
        </TouchableOpacity>


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
  collageContainer: {
    width: width,
    height: width * 0.72,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingTop: 0,
    marginTop: -8,
  },
  collageImage: {
    width: "95%",
    height: "100%",
  },
  title: {
    fontSize: 26,
    fontFamily: "EBGaramond_700Bold",
    textAlign: "center",
    color: BROWN,
    marginTop: -4,
    marginBottom: 0,
    paddingHorizontal: 24,
    lineHeight: 34,
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 22,
    fontFamily: "EBGaramond_400Regular_Italic",
    textAlign: "center",
    color: BROWN,
    marginTop: -2,
    marginBottom: 0,
    paddingHorizontal: 24,
    lineHeight: 28,
  },
  descriptionContainer: {
    paddingHorizontal: 24,
    paddingTop: 2,
    gap: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "EBGaramond_400Regular_Italic",
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  infoCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  infoNumber: {
    fontSize: 20,
    fontFamily: "EBGaramond_700Bold",
  },
  infoLabel: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: "EBGaramond_400Regular",
  },
  startButton: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  startButtonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "EBGaramond_700Bold",
  },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 4,
  },
  backText: {
    fontSize: 15,
    fontFamily: "EBGaramond_400Regular",
    color: BROWN_MUTED,
  },
});
