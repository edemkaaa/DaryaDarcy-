import React, { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Platform,
  FlatList,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useQuiz } from "@/lib/quiz-state";
import { useClub } from "@/lib/club-context";
import { AESTHETIC_NAMES, type AestheticKey } from "@/lib/quiz-data";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import { COTTAGECORE_RESULT, type CottagecoreResultContent } from "@/lib/content/cottagecore-result";
import { DARK_ACADEMIA_RESULT } from "@/lib/content/darkacademia-result";
import { GOBLINCORE_RESULT } from "@/lib/content/goblincore-result";
import { CASTLECORE_RESULT } from "@/lib/content/castlecore-result";
import { WITCHCORE_RESULT } from "@/lib/content/witchcore-result";
import { FAIRYCORE_RESULT } from "@/lib/content/fairycore-result";
import { LIGHT_ACADEMIA_RESULT } from "@/lib/content/lightacademia-result";
import { formatInspirationList } from "@/lib/inspiration-titles";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const { width } = Dimensions.get("window");

// Brown color palette for result screen
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const BROWN_LIGHT = "#A0845C";
const CREAM = "#FDF8F0";

const HOUSE_IMAGES: Record<AestheticKey, any> = {
  cottagecore: require("@/assets/quiz/houses/cottagecore.jpg"),
  goblincore: require("@/assets/quiz/houses/goblincore.jpg"),
  witchcore: require("@/assets/quiz/houses/witchcore.jpg"),
  castlecore: require("@/assets/quiz/houses/castlecore.jpg"),
  fairycore: require("@/assets/quiz/houses/fairycore.jpg"),
  darkAcademia: require("@/assets/quiz/houses/dark-academia.jpg"),
  lightAcademia: require("@/assets/quiz/houses/light-academia.jpg"),
};

// Club content images for cottagecore
const COTTAGECORE_MOODBOARDS = [
  require("@/assets/results/cottagecore/moodboards/moodboard1.png"),
  require("@/assets/results/cottagecore/moodboards/moodboard2.webp"),
  require("@/assets/results/cottagecore/moodboards/moodboard3.png"),
  require("@/assets/results/cottagecore/moodboards/moodboard4.webp"),
  require("@/assets/results/cottagecore/moodboards/moodboard5.png"),
  require("@/assets/results/cottagecore/moodboards/moodboard6.png"),
  require("@/assets/results/cottagecore/moodboards/moodboard7.webp"),
  require("@/assets/results/cottagecore/moodboards/moodboard8.webp"),
  require("@/assets/results/cottagecore/moodboards/moodboard9.png"),
];

const COTTAGECORE_OUTFITS = [
  require("@/assets/results/cottagecore/outfits/outfit1.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit2.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit3.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit4.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit5.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit6.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit7.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit8.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit9.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit10.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit11.jpg"),
  require("@/assets/results/cottagecore/outfits/outfit12.jpg"),
];

const COTTAGECORE_INTERIORS = [
  require("@/assets/results/cottagecore/interiors/interior1.jpg"),
  require("@/assets/results/cottagecore/interiors/interior2.jpg"),
  require("@/assets/results/cottagecore/interiors/interior3.jpg"),
  require("@/assets/results/cottagecore/interiors/interior4.jpg"),
];

// Club content images for Dark Academia
const DARKACADEMIA_OUTFITS = [
  require("@/assets/results/darkacademia/outfits/outfit1.webp"),
  require("@/assets/results/darkacademia/outfits/outfit2.webp"),
  require("@/assets/results/darkacademia/outfits/outfit3.webp"),
  require("@/assets/results/darkacademia/outfits/outfit4.webp"),
  require("@/assets/results/darkacademia/outfits/outfit5.webp"),
  require("@/assets/results/darkacademia/outfits/outfit6.webp"),
  require("@/assets/results/darkacademia/outfits/outfit7.webp"),
  require("@/assets/results/darkacademia/outfits/outfit8.webp"),
  require("@/assets/results/darkacademia/outfits/outfit9.webp"),
  require("@/assets/results/darkacademia/outfits/outfit10.webp"),
  require("@/assets/results/darkacademia/outfits/outfit11.webp"),
  require("@/assets/results/darkacademia/outfits/outfit12.webp"),
  require("@/assets/results/darkacademia/outfits/outfit13.png"),
];

const DARKACADEMIA_MOODBOARDS = [
  require("@/assets/results/darkacademia/moodboards/moodboard1.jpg"),
  require("@/assets/results/darkacademia/moodboards/moodboard2.jpg"),
  require("@/assets/results/darkacademia/moodboards/moodboard3.jpg"),
  require("@/assets/results/darkacademia/moodboards/moodboard4.jpg"),
  require("@/assets/results/darkacademia/moodboards/moodboard5.jpg"),
  require("@/assets/results/darkacademia/moodboards/moodboard6.jpg"),
  require("@/assets/results/darkacademia/moodboards/moodboard7.jpg"),
  require("@/assets/results/darkacademia/moodboards/moodboard8.jpg"),
];

const DARKACADEMIA_INTERIORS = [
  require("@/assets/results/darkacademia/interiors/interior1.webp"),
  require("@/assets/results/darkacademia/interiors/interior2.jpg"),
  require("@/assets/results/darkacademia/interiors/interior3.jpg"),
  require("@/assets/results/darkacademia/interiors/interior4.jpg"),
  require("@/assets/results/darkacademia/interiors/interior5.jpg"),
  require("@/assets/results/darkacademia/interiors/interior6.jpg"),
  require("@/assets/results/darkacademia/interiors/interior7.webp"),
  require("@/assets/results/darkacademia/interiors/interior8.jpg"),
];

// Club content images for Goblincore
const GOBLINCORE_OUTFITS = [
  require("@/assets/results/goblincore/outfits/outfit1.webp"),
  require("@/assets/results/goblincore/outfits/outfit2.webp"),
  require("@/assets/results/goblincore/outfits/outfit3.webp"),
  require("@/assets/results/goblincore/outfits/outfit4.webp"),
  require("@/assets/results/goblincore/outfits/outfit5.webp"),
  require("@/assets/results/goblincore/outfits/outfit6.webp"),
  require("@/assets/results/goblincore/outfits/outfit7.webp"),
  require("@/assets/results/goblincore/outfits/outfit8.webp"),
  require("@/assets/results/goblincore/outfits/outfit9.webp"),
  require("@/assets/results/goblincore/outfits/outfit10.webp"),
  require("@/assets/results/goblincore/outfits/outfit11.webp"),
  require("@/assets/results/goblincore/outfits/outfit12.webp"),
  require("@/assets/results/goblincore/outfits/outfit13.webp"),
  require("@/assets/results/goblincore/outfits/outfit14.webp"),
  require("@/assets/results/goblincore/outfits/outfit15.jpg"),
];

const GOBLINCORE_MOODBOARDS = [
  require("@/assets/results/goblincore/moodboards/mood1.jpg"),
  require("@/assets/results/goblincore/moodboards/mood2.jpg"),
  require("@/assets/results/goblincore/moodboards/mood3.jpg"),
  require("@/assets/results/goblincore/moodboards/mood4.jpg"),
  require("@/assets/results/goblincore/moodboards/mood5.jpg"),
  require("@/assets/results/goblincore/moodboards/mood6.jpg"),
  require("@/assets/results/goblincore/moodboards/mood7.jpg"),
];

const GOBLINCORE_INTERIORS = [
  require("@/assets/results/goblincore/interiors/interior1.jpg"),
  require("@/assets/results/goblincore/interiors/interior2.jpg"),
  require("@/assets/results/goblincore/interiors/interior3.jpg"),
  require("@/assets/results/goblincore/interiors/interior4.jpg"),
  require("@/assets/results/goblincore/interiors/interior5.jpg"),
  require("@/assets/results/goblincore/interiors/interior6.jpg"),
  require("@/assets/results/goblincore/interiors/interior7.jpg"),
  require("@/assets/results/goblincore/interiors/interior8.jpg"),
  require("@/assets/results/goblincore/interiors/interior9.jpg"),
];

// Club content images for Castlecore
const CASTLECORE_OUTFITS = [
  require("@/assets/results/castlecore/outfits/outfit1.webp"),
  require("@/assets/results/castlecore/outfits/outfit2.webp"),
  require("@/assets/results/castlecore/outfits/outfit3.png"),
  require("@/assets/results/castlecore/outfits/outfit4.webp"),
  require("@/assets/results/castlecore/outfits/outfit5.webp"),
  require("@/assets/results/castlecore/outfits/outfit6.webp"),
  require("@/assets/results/castlecore/outfits/outfit7.webp"),
  require("@/assets/results/castlecore/outfits/outfit8.webp"),
  require("@/assets/results/castlecore/outfits/outfit9.webp"),
  require("@/assets/results/castlecore/outfits/outfit10.webp"),
  require("@/assets/results/castlecore/outfits/outfit11.webp"),
  require("@/assets/results/castlecore/outfits/outfit12.webp"),
];

const CASTLECORE_MOODBOARDS = [
  require("@/assets/results/castlecore/moodboards/mood1.jpg"),
  require("@/assets/results/castlecore/moodboards/mood2.jpg"),
  require("@/assets/results/castlecore/moodboards/mood3.jpg"),
  require("@/assets/results/castlecore/moodboards/mood4.jpg"),
  require("@/assets/results/castlecore/moodboards/mood5.jpg"),
  require("@/assets/results/castlecore/moodboards/mood6.jpg"),
  require("@/assets/results/castlecore/moodboards/mood7.jpg"),
  require("@/assets/results/castlecore/moodboards/mood8.jpg"),
  require("@/assets/results/castlecore/moodboards/mood9.jpg"),
];

const CASTLECORE_INTERIORS = [
  require("@/assets/results/castlecore/interiors/interior1.jpg"),
  require("@/assets/results/castlecore/interiors/interior2.jpg"),
  require("@/assets/results/castlecore/interiors/interior3.jpg"),
  require("@/assets/results/castlecore/interiors/interior4.jpg"),
  require("@/assets/results/castlecore/interiors/interior5.jpg"),
  require("@/assets/results/castlecore/interiors/interior6.jpg"),
  require("@/assets/results/castlecore/interiors/interior7.jpg"),
  require("@/assets/results/castlecore/interiors/interior8.jpg"),
  require("@/assets/results/castlecore/interiors/interior9.jpg"),
  require("@/assets/results/castlecore/interiors/interior10.jpg"),
  require("@/assets/results/castlecore/interiors/interior11.jpg"),
  require("@/assets/results/castlecore/interiors/interior12.jpg"),
  require("@/assets/results/castlecore/interiors/interior13.jpg"),
];

// Club content images for Witchcore
const WITCHCORE_OUTFITS = [
  require("@/assets/results/witchcore/outfits/outfit1.webp"),
  require("@/assets/results/witchcore/outfits/outfit2.webp"),
  require("@/assets/results/witchcore/outfits/outfit3.webp"),
  require("@/assets/results/witchcore/outfits/outfit4.webp"),
  require("@/assets/results/witchcore/outfits/outfit5.webp"),
  require("@/assets/results/witchcore/outfits/outfit6.webp"),
  require("@/assets/results/witchcore/outfits/outfit7.webp"),
  require("@/assets/results/witchcore/outfits/outfit8.webp"),
  require("@/assets/results/witchcore/outfits/outfit9.webp"),
  require("@/assets/results/witchcore/outfits/outfit10.png"),
  require("@/assets/results/witchcore/outfits/outfit11.webp"),
  require("@/assets/results/witchcore/outfits/outfit12.webp"),
  require("@/assets/results/witchcore/outfits/outfit13.webp"),
  require("@/assets/results/witchcore/outfits/outfit14.png"),
  require("@/assets/results/witchcore/outfits/outfit15.webp"),
  require("@/assets/results/witchcore/outfits/outfit16.webp"),
  require("@/assets/results/witchcore/outfits/outfit17.webp"),
];

const WITCHCORE_MOODBOARDS = [
  require("@/assets/results/witchcore/moodboards/look1.jpg"),
  require("@/assets/results/witchcore/moodboards/look2.jpg"),
  require("@/assets/results/witchcore/moodboards/look3.jpg"),
  require("@/assets/results/witchcore/moodboards/look4.jpg"),
  require("@/assets/results/witchcore/moodboards/look5.jpg"),
  require("@/assets/results/witchcore/moodboards/look6.jpg"),
  require("@/assets/results/witchcore/moodboards/look7.jpg"),
  require("@/assets/results/witchcore/moodboards/look8.jpg"),
  require("@/assets/results/witchcore/moodboards/look9.jpg"),
];

const WITCHCORE_INTERIORS = [
  require("@/assets/results/witchcore/interiors/interior1.jpg"),
  require("@/assets/results/witchcore/interiors/interior2.jpg"),
  require("@/assets/results/witchcore/interiors/interior3.jpg"),
  require("@/assets/results/witchcore/interiors/interior4.jpg"),
  require("@/assets/results/witchcore/interiors/interior5.jpg"),
  require("@/assets/results/witchcore/interiors/interior6.jpg"),
  require("@/assets/results/witchcore/interiors/interior7.jpg"),
  require("@/assets/results/witchcore/interiors/interior8.jpg"),
];

// Club content images for Fairycore
const FAIRYCORE_OUTFITS = [
  require("@/assets/results/fairycore/outfits/outfit1.webp"),
  require("@/assets/results/fairycore/outfits/outfit2.webp"),
  require("@/assets/results/fairycore/outfits/outfit3.webp"),
  require("@/assets/results/fairycore/outfits/outfit4.webp"),
  require("@/assets/results/fairycore/outfits/outfit5.png"),
  require("@/assets/results/fairycore/outfits/outfit6.webp"),
  require("@/assets/results/fairycore/outfits/outfit7.webp"),
  require("@/assets/results/fairycore/outfits/outfit8.webp"),
  require("@/assets/results/fairycore/outfits/outfit9.webp"),
  require("@/assets/results/fairycore/outfits/outfit10.webp"),
  require("@/assets/results/fairycore/outfits/outfit11.webp"),
  require("@/assets/results/fairycore/outfits/outfit12.webp"),
];

const FAIRYCORE_MOODBOARDS = [
  require("@/assets/results/fairycore/moodboards/look1.jpg"),
  require("@/assets/results/fairycore/moodboards/look2.jpg"),
  require("@/assets/results/fairycore/moodboards/look3.jpg"),
  require("@/assets/results/fairycore/moodboards/look4.jpg"),
  require("@/assets/results/fairycore/moodboards/look5.jpg"),
  require("@/assets/results/fairycore/moodboards/look6.jpg"),
  require("@/assets/results/fairycore/moodboards/look7.jpg"),
  require("@/assets/results/fairycore/moodboards/look8.jpg"),
];

const FAIRYCORE_INTERIORS = [
  require("@/assets/results/fairycore/interiors/interior1.jpg"),
  require("@/assets/results/fairycore/interiors/interior2.jpg"),
  require("@/assets/results/fairycore/interiors/interior3.jpg"),
  require("@/assets/results/fairycore/interiors/interior4.jpg"),
  require("@/assets/results/fairycore/interiors/interior5.jpg"),
  require("@/assets/results/fairycore/interiors/interior6.jpg"),
  require("@/assets/results/fairycore/interiors/interior7.jpg"),
  require("@/assets/results/fairycore/interiors/interior8.jpg"),
  require("@/assets/results/fairycore/interiors/interior9.jpg"),
  require("@/assets/results/fairycore/interiors/interior10.jpg"),
];

// Club content images for Light Academia
const LIGHTACADEMIA_OUTFITS = [
  require("@/assets/results/lightacademia/outfits/outfit1.webp"),
  require("@/assets/results/lightacademia/outfits/outfit2.webp"),
  require("@/assets/results/lightacademia/outfits/outfit3.webp"),
  require("@/assets/results/lightacademia/outfits/outfit4.webp"),
  require("@/assets/results/lightacademia/outfits/outfit5.webp"),
  require("@/assets/results/lightacademia/outfits/outfit6.webp"),
  require("@/assets/results/lightacademia/outfits/outfit7.webp"),
  require("@/assets/results/lightacademia/outfits/outfit8.webp"),
  require("@/assets/results/lightacademia/outfits/outfit9.webp"),
  require("@/assets/results/lightacademia/outfits/outfit10.webp"),
  require("@/assets/results/lightacademia/outfits/outfit11.webp"),
  require("@/assets/results/lightacademia/outfits/outfit12.webp"),
  require("@/assets/results/lightacademia/outfits/outfit13.webp"),
  require("@/assets/results/lightacademia/outfits/outfit14.webp"),
  require("@/assets/results/lightacademia/outfits/outfit15.webp"),
  require("@/assets/results/lightacademia/outfits/outfit16.webp"),
];

const LIGHTACADEMIA_MOODBOARDS = [
  require("@/assets/results/lightacademia/moodboards/moodboard1.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard2.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard3.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard4.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard5.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard6.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard7.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard8.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard9.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard10.jpg"),
  require("@/assets/results/lightacademia/moodboards/moodboard11.jpg"),
];

const LIGHTACADEMIA_INTERIORS = [
  require("@/assets/results/lightacademia/interiors/interior1.jpg"),
  require("@/assets/results/lightacademia/interiors/interior2.jpg"),
  require("@/assets/results/lightacademia/interiors/interior3.jpg"),
  require("@/assets/results/lightacademia/interiors/interior4.jpg"),
  require("@/assets/results/lightacademia/interiors/interior5.jpg"),
  require("@/assets/results/lightacademia/interiors/interior6.jpg"),
  require("@/assets/results/lightacademia/interiors/interior7.jpg"),
  require("@/assets/results/lightacademia/interiors/interior8.jpg"),
  require("@/assets/results/lightacademia/interiors/interior9.jpg"),
  require("@/assets/results/lightacademia/interiors/interior10.jpg"),
  require("@/assets/results/lightacademia/interiors/interior11.jpg"),
];

// Get club content for a given aesthetic
function getClubContent(key: AestheticKey): CottagecoreResultContent | null {
  if (key === "cottagecore") return COTTAGECORE_RESULT;
  if (key === "darkAcademia") return DARK_ACADEMIA_RESULT;
  if (key === "goblincore") return GOBLINCORE_RESULT;
  if (key === "castlecore") return CASTLECORE_RESULT;
  if (key === "witchcore") return WITCHCORE_RESULT;
  if (key === "fairycore") return FAIRYCORE_RESULT;
  if (key === "lightAcademia") return LIGHT_ACADEMIA_RESULT;
  return null;
}

export function QuizResultScreen() {
  const { state, dispatch } = useQuiz();
  const { isSubscribed } = useClub();
  const colors = useColors();
  const result = state.result;
  const [showClubContent, setShowClubContent] = useState(false);
  const [activeKey, setActiveKey] = useState<AestheticKey | null>(null);

  useEffect(() => {
    if (!isSubscribed) setShowClubContent(false);
  }, [isSubscribed]);

  // Persist result to AsyncStorage when it becomes available
  useEffect(() => {
    if (result) {
      const resultData = {
        primaryKey: result.primary.key,
        primaryTitle: result.primary.title,
        secondaryKey: result.secondary?.key || null,
        isBlend: result.isBlend,
        scores: result.scores,
        completedAt: new Date().toISOString(),
      };
      AsyncStorage.setItem("@darcy_quiz_result", JSON.stringify(resultData));
    }
  }, [result]);

  if (!result) return null;

  const { primary, secondary, isBlend, scores } = result;

  // Determine the active aesthetic (for blend tab switching)
  const currentKey = activeKey || primary.key;
  const activeResult = (isBlend && secondary && currentKey === secondary.key) ? secondary : primary;
  const houseImage = HOUSE_IMAGES[activeResult.key];
  const clubContent = getClubContent(activeResult.key);

  const handleTabSwitch = (key: AestheticKey) => {
    if (key !== currentKey) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setActiveKey(key);
      setShowClubContent(false);
    }
  };

  const handleRestart = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    dispatch({ type: "RESTART" });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Мой результат в тесте "Какая твоя сказка?" — ${AESTHETIC_NAMES[activeResult.key]}! ${activeResult.title}`,
      });
    } catch {}
  };

  const handleBack = () => {
    router.back();
  };

  const handleClubCTA = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isSubscribed && clubContent) {
      setShowClubContent(true);
    } else {
      // Navigate to club tab (subscription page)
      router.push("/(tabs)/club");
    }
  };

  // Determine which key is highlighted in score bars
  const highlightKey = activeResult.key;

  // Score bar data
  const maxScore = Math.max(...Object.values(scores));
  const sortedScores = (Object.keys(scores) as AestheticKey[])
    .map((key) => ({ key, score: scores[key] }))
    .sort((a, b) => b.score - a.score);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Blend Tab Switcher */}
        {isBlend && secondary && (
          <View style={styles.blendTabs}>
            <TouchableOpacity
              style={[
                styles.blendTab,
                currentKey === primary.key && styles.blendTabActive,
              ]}
              onPress={() => handleTabSwitch(primary.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.blendTabText,
                  currentKey === primary.key && styles.blendTabTextActive,
                ]}
              >
                {AESTHETIC_NAMES[primary.key]}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.blendTab,
                currentKey === secondary.key && styles.blendTabActive,
              ]}
              onPress={() => handleTabSwitch(secondary.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.blendTabText,
                  currentKey === secondary.key && styles.blendTabTextActive,
                ]}
              >
                {AESTHETIC_NAMES[secondary.key]}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero */}
        <View style={styles.heroContainer}>
          <Image source={houseImage} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={["transparent", "rgba(20,15,10,0.9)"]}
            style={styles.gradient}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.aestheticLabel}>
              {AESTHETIC_NAMES[activeResult.key]}
            </Text>
            <Text style={styles.heroTitle}>{activeResult.title}</Text>
            {isBlend && secondary && (
              <Text style={styles.blendLabel}>
                с оттенком {AESTHETIC_NAMES[currentKey === primary.key ? secondary.key : primary.key]}
              </Text>
            )}
          </View>
        </View>

        {/* Archetype */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.cardLabel}>Архетип</Text>
          <Text style={styles.cardValue}>{activeResult.archetype}</Text>
        </View>

        {/* Fairy Tale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Твоя сказка</Text>
          <Text style={styles.bodyText}>{activeResult.fairyTale}</Text>
        </View>

        {/* Role Models */}
        {activeResult.roleModels ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={styles.cardLabel}>Ролевые модели</Text>
            <Text style={styles.cardValue}>{activeResult.roleModels}</Text>
          </View>
        ) : null}

        {/* Depth */}
        {activeResult.depth ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Глубина</Text>
            <Text style={styles.bodyText}>{activeResult.depth}</Text>
          </View>
        ) : null}

        {/* Score Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Распределение баллов</Text>
          <View style={styles.scoresContainer}>
            {sortedScores.map(({ key, score }) => (
              <View key={key} style={styles.scoreRow}>
                <Text
                  style={[
                    styles.scoreName,
                    { color: key === highlightKey ? BROWN : BROWN_MUTED },
                  ]}
                >
                  {AESTHETIC_NAMES[key]}
                </Text>
                <View style={styles.scoreBarContainer}>
                  <View
                    style={[styles.scoreBar, { backgroundColor: colors.surface }]}
                  >
                    <View
                      style={[
                        styles.scoreBarFill,
                        {
                          backgroundColor:
                            key === highlightKey ? BROWN : BROWN_MUTED + "60",
                          width:
                            maxScore > 0
                              ? `${(score / maxScore) * 100}%`
                              : "0%",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.scoreValue}>{score}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Club CTA Block */}
        {clubContent && !showClubContent && (
          <View style={styles.clubCTA}>
            {isSubscribed ? (
              <>
                <Text style={styles.clubCTAPrivilege}>
                  Вам доступен полный гид по вашей эстетике
                </Text>
                <Text style={styles.clubCTASubtext}>
                  Привилегия участницы Клуба Darcy
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.clubCTAText}>
                  Узнать конкретные советы по стилю, интерьеру, ведению блога
                </Text>
                <Text style={styles.clubCTASubtext}>
                  Для участниц Клуба Darcy
                </Text>
              </>
            )}
            <TouchableOpacity
              style={[
                styles.clubCTAButton,
                { backgroundColor: BROWN },
              ]}
              onPress={handleClubCTA}
              activeOpacity={0.8}
            >
              <Text style={styles.clubCTAButtonText}>
                {isSubscribed ? "Читать" : "Вступить в клуб"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Club Content (expanded) */}
        {showClubContent && isSubscribed && clubContent && (
          <ClubContentSection content={clubContent} aestheticKey={activeResult.key} />
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: BROWN }]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareButtonText}>Поделиться результатом</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.restartButton, { borderColor: BROWN_LIGHT }]}
            onPress={handleRestart}
            activeOpacity={0.7}
          >
            <Text style={styles.restartButtonText}>Пройти ещё раз</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLink}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Text style={styles.backLinkText}>← Вернуться</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </ImageBackground>
  </ScreenContainer>
  );
}

// ─── Club Content Section ────────────────────────────────────────────────────

function ClubContentSection({
  content,
  aestheticKey,
}: {
  content: CottagecoreResultContent;
  aestheticKey: AestheticKey;
}) {
  const moodboards =
    aestheticKey === "cottagecore" ? COTTAGECORE_MOODBOARDS :
    aestheticKey === "darkAcademia" ? DARKACADEMIA_MOODBOARDS :
    aestheticKey === "goblincore" ? GOBLINCORE_MOODBOARDS :
    aestheticKey === "castlecore" ? CASTLECORE_MOODBOARDS :
    aestheticKey === "witchcore" ? WITCHCORE_MOODBOARDS :
    aestheticKey === "fairycore" ? FAIRYCORE_MOODBOARDS :
    aestheticKey === "lightAcademia" ? LIGHTACADEMIA_MOODBOARDS :
    [];
  const outfits =
    aestheticKey === "cottagecore" ? COTTAGECORE_OUTFITS :
    aestheticKey === "darkAcademia" ? DARKACADEMIA_OUTFITS :
    aestheticKey === "goblincore" ? GOBLINCORE_OUTFITS :
    aestheticKey === "castlecore" ? CASTLECORE_OUTFITS :
    aestheticKey === "witchcore" ? WITCHCORE_OUTFITS :
    aestheticKey === "fairycore" ? FAIRYCORE_OUTFITS :
    aestheticKey === "lightAcademia" ? LIGHTACADEMIA_OUTFITS :
    [];
  const interiors =
    aestheticKey === "cottagecore" ? COTTAGECORE_INTERIORS :
    aestheticKey === "darkAcademia" ? DARKACADEMIA_INTERIORS :
    aestheticKey === "goblincore" ? GOBLINCORE_INTERIORS :
    aestheticKey === "castlecore" ? CASTLECORE_INTERIORS :
    aestheticKey === "witchcore" ? WITCHCORE_INTERIORS :
    aestheticKey === "fairycore" ? FAIRYCORE_INTERIORS :
    aestheticKey === "lightAcademia" ? LIGHTACADEMIA_INTERIORS :
    [];

  return (
    <View style={styles.clubContent}>
      {/* Style Section */}
      <View style={styles.section}>
        <Text style={styles.clubSectionTitle}>СТИЛЬ</Text>
        <Text style={styles.bodyText}>{content.style.intro}</Text>

        {/* Style Table */}
        <View style={styles.styleTable}>
          <View style={styles.styleTableRow}>
            <View style={styles.styleTableHeader}>
              <Text style={styles.styleTableHeaderText}>
                {aestheticKey === "darkAcademia" ? "Академическое настроение" :
                 aestheticKey === "goblincore" ? "Практичное" :
                 aestheticKey === "castlecore" ? "Величественное" :
                 aestheticKey === "witchcore" ? "Мистическое" :
                 aestheticKey === "fairycore" ? "Нежное" :
                 aestheticKey === "lightAcademia" ? "Силуэты" :
                 "Романтическое"}
              </Text>
            </View>
            <View style={styles.styleTableHeader}>
              <Text style={styles.styleTableHeaderText}>
                {aestheticKey === "darkAcademia" ? "Романтическое настроение" :
                 aestheticKey === "goblincore" ? "Игривое" :
                 aestheticKey === "castlecore" ? "Женственное" :
                 aestheticKey === "witchcore" ? "Природное" :
                 aestheticKey === "fairycore" ? "Дерзкое" :
                 aestheticKey === "lightAcademia" ? "Детали" :
                 "Рабочее"}
              </Text>
            </View>
          </View>
          {content.style.table.romantic.map((item, i) => (
            <View key={i} style={styles.styleTableRow}>
              <View style={styles.styleTableCell}>
                <Text style={styles.styleTableCellText}>{item}</Text>
              </View>
              <View style={styles.styleTableCell}>
                <Text style={styles.styleTableCellText}>
                  {content.style.table.workwear[i] || ""}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Outfits (items without background) — always shown first after table */}
        {outfits.length > 0 && (
          <View style={styles.carouselContainer}>
            <FlatList
              data={outfits}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `outfit-${i}`}
              contentContainerStyle={styles.carouselList}
              renderItem={({ item }) => (
                <View style={styles.carouselItemOutfit}>
                  <Image
                    source={item}
                    style={styles.carouselImageOutfit}
                    contentFit="contain"
                  />
                </View>
              )}
            />
          </View>
        )}

        {/* Style Details */}
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>{aestheticKey === "lightAcademia" ? "Основа гардероба: " : "Контраст: "}</Text>
          {content.style.contrast}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Детали: </Text>
          {content.style.details}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Аксессуары: </Text>
          {content.style.accessories}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Обувь: </Text>
          {content.style.shoes}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Ткани: </Text>
          {content.style.fabrics}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Цвета: </Text>
          {content.style.colors}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Бонус: </Text>
          {content.style.bonus}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Принцип: </Text>
          {content.style.principle}
        </Text>
        <Text style={[styles.bodyText, { marginTop: 12 }]}>
          <Text style={styles.italicLabel}>Сочетание с другими эстетиками: </Text>
          {content.style.mixing}
        </Text>

        {/* Moodboards (looks with rounded corners) — always shown last in style section */}
        {moodboards.length > 0 && (
          <View style={styles.carouselContainer}>
            <FlatList
              data={moodboards}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `moodboard-${i}`}
              contentContainerStyle={styles.carouselList}
              renderItem={({ item }) => (
                <View style={styles.carouselItemMoodboard}>
                  <Image
                    source={item}
                    style={styles.carouselImageMoodboard}
                    contentFit="cover"
                  />
                </View>
              )}
            />
          </View>
        )}
      </View>

      {/* Space Section */}
      <View style={styles.section}>
        <Text style={styles.clubSectionTitle}>ПРОСТРАНСТВО</Text>
        <Text style={styles.bodyText}>{content.space.intro}</Text>
        {content.space.finishing ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Отделка: </Text>
            {content.space.finishing}
          </Text>
        ) : null}
        {content.space.wallpaperBrands ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Обои: </Text>
            {content.space.wallpaperBrands}
          </Text>
        ) : null}
        {content.space.ceilings ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Потолки: </Text>
            {content.space.ceilings}
          </Text>
        ) : null}
        {content.space.importantNote ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Важно: </Text>
            {content.space.importantNote}
          </Text>
        ) : null}
        {content.space.palette ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Палитра: </Text>
            {content.space.palette}
          </Text>
        ) : null}
        {content.space.lifehack ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Лайфхак: </Text>
            {content.space.lifehack}
          </Text>
        ) : null}
        {content.space.furniture ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Мебель: </Text>
            {content.space.furniture}
          </Text>
        ) : null}
        {content.space.furnitureWhere ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Где искать: </Text>
            {content.space.furnitureWhere}
          </Text>
        ) : null}
        {content.space.furnitureAvoid ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Избегать: </Text>
            {content.space.furnitureAvoid}
          </Text>
        ) : null}
        {content.space.textile ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Текстиль: </Text>
            {content.space.textile}
          </Text>
        ) : null}
        {content.space.textileFormula ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Формула: </Text>
            {content.space.textileFormula}
          </Text>
        ) : null}
        {content.space.details ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Детали: </Text>
            {content.space.details}
          </Text>
        ) : null}
        {content.space.lighting ? (
          <Text style={styles.bodyText}>
            <Text style={styles.italicLabel}>Освещение: </Text>
            {content.space.lighting}
          </Text>
        ) : null}

        {/* Interior Carousel */}
        {interiors.length > 0 && (
          <View style={styles.carouselContainer}>
            <FlatList
              data={interiors}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `interior-${i}`}
              contentContainerStyle={styles.carouselList}
              renderItem={({ item }) => (
                <View style={styles.carouselItemInterior}>
                  <Image
                    source={item}
                    style={styles.carouselImageInterior}
                    contentFit="cover"
                  />
                </View>
              )}
            />
          </View>
        )}
      </View>

      {/* Rituals Section */}
      <View style={styles.section}>
        <Text style={styles.clubSectionTitle}>РИТУАЛЫ</Text>
        {content.rituals.items.map((ritual, i) => (
          <View key={i} style={styles.ritualItem}>
            <Text style={styles.ritualTitle}>{ritual.title}</Text>
            <Text style={styles.bodyText}>{ritual.description}</Text>
          </View>
        ))}
      </View>

      {/* Blog Section */}
      <View style={styles.section}>
        <Text style={styles.clubSectionTitle}>БЛОГ</Text>
        <Text style={styles.bodyText}>{content.blog.intro}</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.italicLabel}>Сильная сторона: </Text>
          {content.blog.strength}
        </Text>
        <Text style={styles.clubSubtitle}>Рубрики:</Text>
        {content.blog.rubrics.map((rubric, i) => (
          <View key={i} style={styles.ritualItem}>
            <Text style={styles.ritualTitle}>{rubric.title}</Text>
            <Text style={styles.bodyText}>{rubric.description}</Text>
          </View>
        ))}
        <Text style={styles.clubSubtitle}>Советы:</Text>
        {content.blog.tips.map((tip, i) => (
          <Text key={i} style={styles.tipText}>
            • {tip}
          </Text>
        ))}
      </View>

      {/* Inspiration Section */}
      <View style={styles.section}>
        <Text style={styles.clubSectionTitle}>ВДОХНОВЕНИЕ</Text>

        <Text style={styles.clubSubtitle}>Фильмы</Text>
        <Text style={styles.bodyText}>
          {formatInspirationList(content.inspiration.films)}
        </Text>

        <Text style={styles.clubSubtitle}>Сериалы</Text>
        <Text style={styles.bodyText}>
          {formatInspirationList(content.inspiration.series)}
        </Text>

        <Text style={styles.clubSubtitle}>Книги</Text>
        <Text style={styles.bodyText}>
          {formatInspirationList(content.inspiration.books)}
        </Text>

        <Text style={styles.clubSubtitle}>Музыка</Text>
        <Text style={styles.bodyText}>
          {content.inspiration.music.join(", ")}
        </Text>

        <Text style={styles.clubSubtitle}>Блоги</Text>
        <Text style={styles.bodyText}>
          IG: {content.inspiration.blogs.instagram.join(", ")}
        </Text>
        <Text style={styles.bodyText}>
          YouTube: {content.inspiration.blogs.youtube.join(", ")}
        </Text>

        <Text style={styles.clubSubtitle}>Журналы</Text>
        <Text style={styles.bodyText}>
          {formatInspirationList(content.inspiration.magazines)}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 60,
  },
  heroContainer: {
    width: width,
    height: width * 0.85,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
  },
  aestheticLabel: {
    fontSize: 14,
    fontFamily: "EBGaramond_700Bold",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: "EBGaramond_700Bold",
    color: "#fff",
    lineHeight: 34,
  },
  blendLabel: {
    fontSize: 15,
    fontFamily: "EBGaramond_400Regular_Italic",
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "EBGaramond_400Regular_Italic",
    color: BROWN_MUTED,
    marginBottom: 10,
  },
  boldText: {
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
  },
  italicLabel: {
    fontFamily: "EBGaramond_400Regular_Italic",
    color: BROWN,
  },
  card: {
    marginHorizontal: 24,
    marginTop: 20,
    padding: 20,
    borderRadius: 14,
  },
  cardLabel: {
    fontSize: 13,
    fontFamily: "EBGaramond_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    color: BROWN_LIGHT,
  },
  cardValue: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "EBGaramond_400Regular",
    color: BROWN,
  },
  scoresContainer: {
    gap: 10,
  },
  scoreRow: {
    gap: 4,
  },
  scoreName: {
    fontSize: 14,
    fontFamily: "EBGaramond_400Regular",
  },
  scoreBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 13,
    width: 24,
    textAlign: "right",
    fontFamily: "EBGaramond_400Regular",
    color: BROWN_MUTED,
  },
  // Club CTA
  clubCTA: {
    marginHorizontal: 24,
    marginTop: 32,
    padding: 24,
    borderRadius: 16,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "30",
    alignItems: "center",
  },
  clubCTAText: {
    fontSize: 17,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  clubCTAPrivilege: {
    fontSize: 17,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  clubCTASubtext: {
    fontSize: 14,
    fontFamily: "EBGaramond_400Regular_Italic",
    color: BROWN_MUTED,
    marginBottom: 16,
  },
  clubCTAButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  clubCTAButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "EBGaramond_700Bold",
  },
  // Club Content
  clubContent: {
    marginTop: 24,
  },
  clubSectionTitle: {
    fontSize: 22,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    letterSpacing: 2,
    marginBottom: 14,
  },
  clubSubtitle: {
    fontSize: 16,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    marginTop: 14,
    marginBottom: 6,
  },
  // Style Table
  styleTable: {
    marginVertical: 16,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "30",
  },
  styleTableRow: {
    flexDirection: "row",
  },
  styleTableHeader: {
    flex: 1,
    padding: 10,
    backgroundColor: CREAM,
    borderBottomWidth: 1,
    borderBottomColor: BROWN_LIGHT + "30",
  },
  styleTableHeaderText: {
    fontSize: 14,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    textAlign: "center",
  },
  styleTableCell: {
    flex: 1,
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: BROWN_LIGHT + "20",
  },
  styleTableCellText: {
    fontSize: 14,
    fontFamily: "EBGaramond_400Regular",
    color: BROWN_MUTED,
    textAlign: "center",
  },
  // Carousels
  carouselContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  carouselLabel: {
    fontSize: 15,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    marginBottom: 10,
  },
  carouselList: {
    paddingRight: 24,
  },
  carouselItemMoodboard: {
    width: width * 0.45,
    height: width * 0.67,
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: CREAM,
  },
  carouselImageMoodboard: {
    width: "100%",
    height: "100%",
  },
  carouselItemOutfit: {
    width: width * 0.42,
    height: width * 0.56,
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F5F0E6",
  },
  carouselImageOutfit: {
    width: "100%",
    height: "100%",
  },
  carouselItemInterior: {
    width: width * 0.7,
    height: width * 0.5,
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  carouselImageInterior: {
    width: "100%",
    height: "100%",
  },
  // Rituals
  ritualItem: {
    marginBottom: 14,
  },
  ritualTitle: {
    fontSize: 16,
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "EBGaramond_400Regular",
    color: BROWN_MUTED,
    marginBottom: 4,
    paddingLeft: 8,
  },
  // Actions
  actionsContainer: {
    paddingHorizontal: 24,
    marginTop: 36,
    gap: 12,
  },
  shareButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "EBGaramond_700Bold",
  },
  restartButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  restartButtonText: {
    fontSize: 16,
    fontFamily: "EBGaramond_400Regular",
    color: BROWN,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 15,
    fontFamily: "EBGaramond_400Regular_Italic",
    color: BROWN_MUTED,
  },
  // Blend Tab Switcher
  blendTabs: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: CREAM,
  },
  blendTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  blendTabActive: {
    borderBottomColor: BROWN,
  },
  blendTabText: {
    fontSize: 15,
    fontFamily: "EBGaramond_400Regular",
    color: BROWN_MUTED,
  },
  blendTabTextActive: {
    fontFamily: "EBGaramond_700Bold",
    color: BROWN,
  },
});
