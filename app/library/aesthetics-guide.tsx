import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  FlatList,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import { useClub } from "@/lib/club-context";
import { AESTHETIC_NAMES, AESTHETIC_RESULTS, type AestheticKey } from "@/lib/quiz-data";
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

// Colors
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const BROWN_LIGHT = "#A0845C";
const CREAM = "#FDF8F0";

// Aesthetic order
const AESTHETIC_ORDER: AestheticKey[] = [
  "cottagecore",
  "goblincore",
  "witchcore",
  "castlecore",
  "fairycore",
  "darkAcademia",
  "lightAcademia",
];

// House images (hero for each aesthetic)
const HOUSE_IMAGES: Record<AestheticKey, any> = {
  cottagecore: require("@/assets/quiz/houses/cottagecore.jpg"),
  goblincore: require("@/assets/quiz/houses/goblincore.jpg"),
  witchcore: require("@/assets/quiz/houses/witchcore.jpg"),
  castlecore: require("@/assets/quiz/houses/castlecore.jpg"),
  fairycore: require("@/assets/quiz/houses/fairycore.jpg"),
  darkAcademia: require("@/assets/quiz/houses/dark-academia.jpg"),
  lightAcademia: require("@/assets/quiz/houses/light-academia.jpg"),
};

// Moodboard images
const MOODBOARDS: Record<AestheticKey, any[]> = {
  cottagecore: [
    require("@/assets/results/cottagecore/moodboards/moodboard1.png"),
    require("@/assets/results/cottagecore/moodboards/moodboard2.webp"),
    require("@/assets/results/cottagecore/moodboards/moodboard3.png"),
    require("@/assets/results/cottagecore/moodboards/moodboard4.webp"),
    require("@/assets/results/cottagecore/moodboards/moodboard5.png"),
  ],
  goblincore: [
    require("@/assets/results/goblincore/moodboards/mood1.jpg"),
    require("@/assets/results/goblincore/moodboards/mood2.jpg"),
    require("@/assets/results/goblincore/moodboards/mood3.jpg"),
    require("@/assets/results/goblincore/moodboards/mood4.jpg"),
    require("@/assets/results/goblincore/moodboards/mood5.jpg"),
  ],
  witchcore: [
    require("@/assets/results/witchcore/moodboards/look1.jpg"),
    require("@/assets/results/witchcore/moodboards/look2.jpg"),
    require("@/assets/results/witchcore/moodboards/look3.jpg"),
    require("@/assets/results/witchcore/moodboards/look4.jpg"),
    require("@/assets/results/witchcore/moodboards/look5.jpg"),
  ],
  castlecore: [
    require("@/assets/results/castlecore/moodboards/mood1.jpg"),
    require("@/assets/results/castlecore/moodboards/mood2.jpg"),
    require("@/assets/results/castlecore/moodboards/mood3.jpg"),
    require("@/assets/results/castlecore/moodboards/mood4.jpg"),
    require("@/assets/results/castlecore/moodboards/mood5.jpg"),
  ],
  fairycore: [
    require("@/assets/results/fairycore/moodboards/look1.jpg"),
    require("@/assets/results/fairycore/moodboards/look2.jpg"),
    require("@/assets/results/fairycore/moodboards/look3.jpg"),
    require("@/assets/results/fairycore/moodboards/look4.jpg"),
    require("@/assets/results/fairycore/moodboards/look5.jpg"),
  ],
  darkAcademia: [
    require("@/assets/results/darkacademia/moodboards/moodboard1.jpg"),
    require("@/assets/results/darkacademia/moodboards/moodboard2.jpg"),
    require("@/assets/results/darkacademia/moodboards/moodboard3.jpg"),
    require("@/assets/results/darkacademia/moodboards/moodboard4.jpg"),
    require("@/assets/results/darkacademia/moodboards/moodboard5.jpg"),
  ],
  lightAcademia: [
    require("@/assets/results/lightacademia/moodboards/moodboard1.jpg"),
    require("@/assets/results/lightacademia/moodboards/moodboard2.jpg"),
    require("@/assets/results/lightacademia/moodboards/moodboard3.jpg"),
    require("@/assets/results/lightacademia/moodboards/moodboard4.jpg"),
    require("@/assets/results/lightacademia/moodboards/moodboard5.jpg"),
  ],
};

// Outfit images
const OUTFITS: Record<AestheticKey, any[]> = {
  cottagecore: [
    require("@/assets/results/cottagecore/outfits/outfit1.jpg"),
    require("@/assets/results/cottagecore/outfits/outfit2.jpg"),
    require("@/assets/results/cottagecore/outfits/outfit3.jpg"),
    require("@/assets/results/cottagecore/outfits/outfit4.jpg"),
    require("@/assets/results/cottagecore/outfits/outfit5.jpg"),
  ],
  goblincore: [
    require("@/assets/results/goblincore/outfits/outfit1.webp"),
    require("@/assets/results/goblincore/outfits/outfit2.webp"),
    require("@/assets/results/goblincore/outfits/outfit3.webp"),
    require("@/assets/results/goblincore/outfits/outfit4.webp"),
    require("@/assets/results/goblincore/outfits/outfit5.webp"),
  ],
  witchcore: [
    require("@/assets/results/witchcore/outfits/outfit1.webp"),
    require("@/assets/results/witchcore/outfits/outfit2.webp"),
    require("@/assets/results/witchcore/outfits/outfit3.webp"),
    require("@/assets/results/witchcore/outfits/outfit4.webp"),
    require("@/assets/results/witchcore/outfits/outfit5.webp"),
  ],
  castlecore: [
    require("@/assets/results/castlecore/outfits/outfit1.webp"),
    require("@/assets/results/castlecore/outfits/outfit2.webp"),
    require("@/assets/results/castlecore/outfits/outfit3.png"),
    require("@/assets/results/castlecore/outfits/outfit4.webp"),
    require("@/assets/results/castlecore/outfits/outfit5.webp"),
  ],
  fairycore: [
    require("@/assets/results/fairycore/outfits/outfit1.webp"),
    require("@/assets/results/fairycore/outfits/outfit2.webp"),
    require("@/assets/results/fairycore/outfits/outfit3.webp"),
    require("@/assets/results/fairycore/outfits/outfit4.webp"),
    require("@/assets/results/fairycore/outfits/outfit5.png"),
  ],
  darkAcademia: [
    require("@/assets/results/darkacademia/outfits/outfit1.webp"),
    require("@/assets/results/darkacademia/outfits/outfit2.webp"),
    require("@/assets/results/darkacademia/outfits/outfit3.webp"),
    require("@/assets/results/darkacademia/outfits/outfit4.webp"),
    require("@/assets/results/darkacademia/outfits/outfit5.webp"),
  ],
  lightAcademia: [
    require("@/assets/results/lightacademia/outfits/outfit1.webp"),
    require("@/assets/results/lightacademia/outfits/outfit2.webp"),
    require("@/assets/results/lightacademia/outfits/outfit3.webp"),
    require("@/assets/results/lightacademia/outfits/outfit4.webp"),
    require("@/assets/results/lightacademia/outfits/outfit5.webp"),
  ],
};

// Interior images
const INTERIORS: Record<AestheticKey, any[]> = {
  cottagecore: [
    require("@/assets/results/cottagecore/interiors/interior1.jpg"),
    require("@/assets/results/cottagecore/interiors/interior2.jpg"),
    require("@/assets/results/cottagecore/interiors/interior3.jpg"),
    require("@/assets/results/cottagecore/interiors/interior4.jpg"),
  ],
  goblincore: [
    require("@/assets/results/goblincore/interiors/interior1.jpg"),
    require("@/assets/results/goblincore/interiors/interior2.jpg"),
    require("@/assets/results/goblincore/interiors/interior3.jpg"),
    require("@/assets/results/goblincore/interiors/interior4.jpg"),
    require("@/assets/results/goblincore/interiors/interior5.jpg"),
  ],
  witchcore: [
    require("@/assets/results/witchcore/interiors/interior1.jpg"),
    require("@/assets/results/witchcore/interiors/interior2.jpg"),
    require("@/assets/results/witchcore/interiors/interior3.jpg"),
    require("@/assets/results/witchcore/interiors/interior4.jpg"),
    require("@/assets/results/witchcore/interiors/interior5.jpg"),
  ],
  castlecore: [
    require("@/assets/results/castlecore/interiors/interior1.jpg"),
    require("@/assets/results/castlecore/interiors/interior2.jpg"),
    require("@/assets/results/castlecore/interiors/interior3.jpg"),
    require("@/assets/results/castlecore/interiors/interior4.jpg"),
    require("@/assets/results/castlecore/interiors/interior5.jpg"),
  ],
  fairycore: [
    require("@/assets/results/fairycore/interiors/interior1.jpg"),
    require("@/assets/results/fairycore/interiors/interior2.jpg"),
    require("@/assets/results/fairycore/interiors/interior3.jpg"),
    require("@/assets/results/fairycore/interiors/interior4.jpg"),
    require("@/assets/results/fairycore/interiors/interior5.jpg"),
  ],
  darkAcademia: [
    require("@/assets/results/darkacademia/interiors/interior1.webp"),
    require("@/assets/results/darkacademia/interiors/interior2.jpg"),
    require("@/assets/results/darkacademia/interiors/interior3.jpg"),
    require("@/assets/results/darkacademia/interiors/interior4.jpg"),
    require("@/assets/results/darkacademia/interiors/interior5.jpg"),
  ],
  lightAcademia: [
    require("@/assets/results/lightacademia/interiors/interior1.jpg"),
    require("@/assets/results/lightacademia/interiors/interior2.jpg"),
    require("@/assets/results/lightacademia/interiors/interior3.jpg"),
    require("@/assets/results/lightacademia/interiors/interior4.jpg"),
    require("@/assets/results/lightacademia/interiors/interior5.jpg"),
  ],
};

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

// Table headers per aesthetic
function getTableHeaders(key: AestheticKey): [string, string] {
  switch (key) {
    case "darkAcademia": return ["Академическое настроение", "Романтическое настроение"];
    case "goblincore": return ["Практичное", "Игривое"];
    case "castlecore": return ["Величественное", "Женственное"];
    case "witchcore": return ["Мистическое", "Природное"];
    case "fairycore": return ["Нежное", "Дерзкое"];
    case "lightAcademia": return ["Силуэты", "Детали"];
    default: return ["Романтическое", "Рабочее"];
  }
}

export default function AestheticsGuideScreen() {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const { isSubscribed } = useClub();

  const handleBack = () => {
    router.back();
  };

  const handleQuizCTA = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/quiz");
  };

  const handleClubCTA = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/(tabs)/club");
  };

  // Scroll to section by index
  const sectionRefs = useRef<Record<string, number>>({});

  const scrollToSection = (key: AestheticKey) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const y = sectionRefs.current[key];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y: y - 20, animated: true });
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Header */}
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg" }}
            style={styles.bannerImage}
            contentFit="cover"
          />
          <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.backButtonOverlay}>
            <Text style={styles.backButtonOverlayText}>← Назад</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Gate */}
        {!isSubscribed ? (
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedText}>привилегия участниц Клуба Darcy</Text>
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
              <Text style={styles.quizLinkText}>Определить свою эстетику →</Text>
            </TouchableOpacity>

            {/* Blurred TOC Preview */}
            <View style={styles.blurPreviewWrapper}>
              <View style={styles.blurPreviewContent}>
                <Text style={styles.tocTitle}>ОГЛАВЛЕНИЕ</Text>
                {AESTHETIC_ORDER.map((key, index) => (
                  <View key={key} style={styles.tocItem}>
                    <Text style={styles.tocNumber}>{index + 1}.</Text>
                    <Text style={styles.tocName}>{AESTHETIC_NAMES[key]}</Text>
                  </View>
                ))}
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
            {/* CTA Buttons */}
            <View style={styles.ctaContainer}>
              <TouchableOpacity
                style={styles.ctaButtonOlive}
                onPress={handleQuizCTA}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaButtonOliveText}>Определить свою эстетику →</Text>
              </TouchableOpacity>
            </View>

            {/* Table of Contents */}
            <View style={styles.tocContainer}>
              <Text style={styles.tocTitle}>ОГЛАВЛЕНИЕ</Text>
              {AESTHETIC_ORDER.map((key, index) => (
                <TouchableOpacity
                  key={key}
                  style={styles.tocItem}
                  onPress={() => scrollToSection(key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tocNumber}>{index + 1}.</Text>
                  <Text style={styles.tocName}>{AESTHETIC_NAMES[key]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Aesthetic Sections (only for subscribers) */}
        {isSubscribed && AESTHETIC_ORDER.map((key) => {
          const result = AESTHETIC_RESULTS[key];
          const clubContent = getClubContent(key);
          const moodboards = MOODBOARDS[key];
          const outfits = OUTFITS[key];
          const interiors = INTERIORS[key];
          const [header1, header2] = getTableHeaders(key);

          return (
            <View
              key={key}
              onLayout={(e) => {
                sectionRefs.current[key] = e.nativeEvent.layout.y;
              }}
              style={styles.aestheticSection}
            >
              {/* Hero Image */}
              <View style={styles.heroContainer}>
                <Image source={HOUSE_IMAGES[key]} style={styles.heroImage} contentFit="cover" />
                <LinearGradient
                  colors={["transparent", "rgba(20,15,10,0.85)"]}
                  style={styles.gradient}
                />
                <View style={styles.heroOverlay}>
                  <Text style={styles.aestheticLabel}>{AESTHETIC_NAMES[key]}</Text>
                  <Text style={styles.heroTitle}>{result.title}</Text>
                </View>
              </View>

              {/* Free Content */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Архетип</Text>
                <Text style={styles.bodyText}>{result.archetype}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Твоя сказка</Text>
                <Text style={styles.bodyText}>{result.fairyTale}</Text>
              </View>

              {result.roleModels ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ролевые модели</Text>
                  <Text style={styles.bodyText}>{result.roleModels}</Text>
                </View>
              ) : null}

              {result.depth ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Глубина</Text>
                  <Text style={styles.bodyText}>{result.depth}</Text>
                </View>
              ) : null}

              {/* Premium Content (Club only) */}
              {isSubscribed && clubContent && (
                <>
                  {/* СТИЛЬ */}
                  <View style={styles.section}>
                    <Text style={styles.clubSectionTitle}>СТИЛЬ</Text>
                    <Text style={styles.bodyText}>{clubContent.style.intro}</Text>

                    {/* Style Table */}
                    <View style={styles.styleTable}>
                      <View style={styles.styleTableRow}>
                        <View style={styles.styleTableHeader}>
                          <Text style={styles.styleTableHeaderText}>{header1}</Text>
                        </View>
                        <View style={styles.styleTableHeader}>
                          <Text style={styles.styleTableHeaderText}>{header2}</Text>
                        </View>
                      </View>
                      {clubContent.style.table.romantic.map((item, i) => (
                        <View key={i} style={styles.styleTableRow}>
                          <View style={styles.styleTableCell}>
                            <Text style={styles.styleTableCellText}>{item}</Text>
                          </View>
                          <View style={styles.styleTableCell}>
                            <Text style={styles.styleTableCellText}>
                              {clubContent.style.table.workwear[i] || ""}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Outfits Carousel */}
                    {outfits.length > 0 && (
                      <View style={styles.carouselContainer}>
                        <FlatList
                          data={outfits}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyExtractor={(_, i) => `${key}-outfit-${i}`}
                          contentContainerStyle={styles.carouselList}
                          renderItem={({ item }) => (
                            <View style={styles.carouselItemOutfit}>
                              <Image source={item} style={styles.carouselImageOutfit} contentFit="contain" />
                            </View>
                          )}
                        />
                      </View>
                    )}

                    {/* Style Details */}
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>{key === "lightAcademia" ? "Основа гардероба: " : "Контраст: "}</Text>
                      {clubContent.style.contrast}
                    </Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Детали: </Text>
                      {clubContent.style.details}
                    </Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Аксессуары: </Text>
                      {clubContent.style.accessories}
                    </Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Обувь: </Text>
                      {clubContent.style.shoes}
                    </Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Ткани: </Text>
                      {clubContent.style.fabrics}
                    </Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Цвета: </Text>
                      {clubContent.style.colors}
                    </Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Бонус: </Text>
                      {clubContent.style.bonus}
                    </Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Принцип: </Text>
                      {clubContent.style.principle}
                    </Text>
                    <Text style={[styles.bodyText, { marginTop: 12 }]}>
                      <Text style={styles.italicLabel}>Сочетание с другими эстетиками: </Text>
                      {clubContent.style.mixing}
                    </Text>

                    {/* Moodboards Carousel */}
                    {moodboards.length > 0 && (
                      <View style={styles.carouselContainer}>
                        <FlatList
                          data={moodboards}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyExtractor={(_, i) => `${key}-mood-${i}`}
                          contentContainerStyle={styles.carouselList}
                          renderItem={({ item }) => (
                            <View style={styles.carouselItemMoodboard}>
                              <Image source={item} style={styles.carouselImageMoodboard} contentFit="cover" />
                            </View>
                          )}
                        />
                      </View>
                    )}
                  </View>

                  {/* ПРОСТРАНСТВО */}
                  <View style={styles.section}>
                    <Text style={styles.clubSectionTitle}>ПРОСТРАНСТВО</Text>
                    <Text style={styles.bodyText}>{clubContent.space.intro}</Text>
                    {clubContent.space.finishing ? (
                      <Text style={styles.bodyText}>
                        <Text style={styles.italicLabel}>Отделка: </Text>
                        {clubContent.space.finishing}
                      </Text>
                    ) : null}
                    {clubContent.space.palette ? (
                      <Text style={styles.bodyText}>
                        <Text style={styles.italicLabel}>Палитра: </Text>
                        {clubContent.space.palette}
                      </Text>
                    ) : null}
                    {clubContent.space.furniture ? (
                      <Text style={styles.bodyText}>
                        <Text style={styles.italicLabel}>Мебель: </Text>
                        {clubContent.space.furniture}
                      </Text>
                    ) : null}
                    {clubContent.space.textile ? (
                      <Text style={styles.bodyText}>
                        <Text style={styles.italicLabel}>Текстиль: </Text>
                        {clubContent.space.textile}
                      </Text>
                    ) : null}
                    {clubContent.space.details ? (
                      <Text style={styles.bodyText}>
                        <Text style={styles.italicLabel}>Детали: </Text>
                        {clubContent.space.details}
                      </Text>
                    ) : null}
                    {clubContent.space.lighting ? (
                      <Text style={styles.bodyText}>
                        <Text style={styles.italicLabel}>Освещение: </Text>
                        {clubContent.space.lighting}
                      </Text>
                    ) : null}

                    {/* Interior Carousel */}
                    {interiors.length > 0 && (
                      <View style={styles.carouselContainer}>
                        <FlatList
                          data={interiors}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyExtractor={(_, i) => `${key}-int-${i}`}
                          contentContainerStyle={styles.carouselList}
                          renderItem={({ item }) => (
                            <View style={styles.carouselItemInterior}>
                              <Image source={item} style={styles.carouselImageInterior} contentFit="cover" />
                            </View>
                          )}
                        />
                      </View>
                    )}
                  </View>

                  {/* РИТУАЛЫ */}
                  <View style={styles.section}>
                    <Text style={styles.clubSectionTitle}>РИТУАЛЫ</Text>
                    {clubContent.rituals.items.map((ritual, i) => (
                      <View key={i} style={styles.ritualItem}>
                        <Text style={styles.ritualTitle}>{ritual.title}</Text>
                        <Text style={styles.bodyText}>{ritual.description}</Text>
                      </View>
                    ))}
                  </View>

                  {/* БЛОГ */}
                  <View style={styles.section}>
                    <Text style={styles.clubSectionTitle}>БЛОГ</Text>
                    <Text style={styles.bodyText}>{clubContent.blog.intro}</Text>
                    <Text style={styles.bodyText}>
                      <Text style={styles.italicLabel}>Сильная сторона: </Text>
                      {clubContent.blog.strength}
                    </Text>
                    <Text style={styles.clubSubtitle}>Рубрики:</Text>
                    {clubContent.blog.rubrics.map((rubric, i) => (
                      <View key={i} style={styles.ritualItem}>
                        <Text style={styles.ritualTitle}>{rubric.title}</Text>
                        <Text style={styles.bodyText}>{rubric.description}</Text>
                      </View>
                    ))}
                    <Text style={styles.clubSubtitle}>Советы:</Text>
                    {clubContent.blog.tips.map((tip, i) => (
                      <Text key={i} style={styles.tipText}>• {tip}</Text>
                    ))}
                  </View>

                  {/* ВДОХНОВЕНИЕ */}
                  <View style={styles.section}>
                    <Text style={styles.clubSectionTitle}>ВДОХНОВЕНИЕ</Text>
                    <Text style={styles.clubSubtitle}>Фильмы</Text>
                    <Text style={styles.bodyText}>{formatInspirationList(clubContent.inspiration.films)}</Text>
                    <Text style={styles.clubSubtitle}>Сериалы</Text>
                    <Text style={styles.bodyText}>{formatInspirationList(clubContent.inspiration.series)}</Text>
                    <Text style={styles.clubSubtitle}>Книги</Text>
                    <Text style={styles.bodyText}>{formatInspirationList(clubContent.inspiration.books)}</Text>
                    <Text style={styles.clubSubtitle}>Музыка</Text>
                    <Text style={styles.bodyText}>{clubContent.inspiration.music.join(", ")}</Text>
                    <Text style={styles.clubSubtitle}>Блоги</Text>
                    <Text style={styles.bodyText}>IG: {clubContent.inspiration.blogs.instagram.join(", ")}</Text>
                    <Text style={styles.bodyText}>YouTube: {clubContent.inspiration.blogs.youtube.join(", ")}</Text>
                    <Text style={styles.clubSubtitle}>Журналы</Text>
                    <Text style={styles.bodyText}>{formatInspirationList(clubContent.inspiration.magazines)}</Text>
                  </View>
                </>
              )}

              {/* Divider between aesthetics */}
              <View style={styles.divider} />
            </View>
          );
        })}

        {/* Bottom CTA (only for subscribers) */}
        {isSubscribed && (
          <View style={styles.bottomCTA}>
            <TouchableOpacity
              style={styles.ctaButtonOlive}
              onPress={handleQuizCTA}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonOliveText}>Определить свою эстетику →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </ImageBackground>
  </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 80,
  },
  bannerContainer: {
    width: "100%",
    aspectRatio: 1024 / 717,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: CREAM,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_MUTED,
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    letterSpacing: 2,
    textAlign: "center",
  },
  pageSubtitle: {
    fontSize: 15,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 8,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 20,
    marginBottom: 24,
  },
  ctaButtonOlive: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#e4e0cd",
  },
  ctaButtonOliveText: {
    color: BROWN,
    fontSize: 18,
    fontFamily: "EBGaramond-Regular",
    letterSpacing: 1,
  },
  ctaButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "EBGaramond-Bold",
  },
  ctaButtonOutline: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  ctaButtonOutlineText: {
    fontSize: 16,
    fontFamily: "EBGaramond-Bold",
  },
  tocContainer: {
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "30",
    marginBottom: 32,
  },
  tocTitle: {
    fontSize: 16,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    letterSpacing: 2,
    marginBottom: 14,
    textAlign: "center",
  },
  tocItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BROWN_LIGHT + "20",
  },
  tocNumber: {
    fontSize: 15,
    fontFamily: "EBGaramond-Bold",
    color: BROWN_LIGHT,
    width: 28,
  },
  tocName: {
    fontSize: 16,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
  },
  gateContainer: {
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 16,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "30",
    alignItems: "center",
    marginBottom: 32,
  },
  gateTitle: {
    fontSize: 17,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    textAlign: "center",
    marginBottom: 8,
  },
  gateText: {
    fontSize: 15,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  aestheticSection: {
    marginBottom: 8,
  },
  heroContainer: {
    width: width,
    height: width * 0.6,
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
    bottom: 20,
    left: 24,
    right: 24,
  },
  aestheticLabel: {
    fontSize: 13,
    fontFamily: "EBGaramond-Bold",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "EBGaramond-Bold",
    color: "#fff",
    lineHeight: 30,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    marginBottom: 8,
  },
  clubSectionTitle: {
    fontSize: 20,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    letterSpacing: 2,
    marginBottom: 12,
  },
  clubSubtitle: {
    fontSize: 16,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    marginTop: 14,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_MUTED,
    marginBottom: 8,
  },
  italicLabel: {
    fontFamily: "EBGaramond-Italic",
    color: BROWN,
  },
  // Style Table
  styleTable: {
    marginVertical: 14,
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
    fontSize: 13,
    fontFamily: "EBGaramond-Bold",
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
    fontSize: 13,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    textAlign: "center",
  },
  // Carousels
  carouselContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  carouselList: {
    paddingRight: 24,
  },
  carouselItemMoodboard: {
    width: width * 0.4,
    height: width * 0.6,
    marginRight: 10,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: CREAM,
  },
  carouselImageMoodboard: {
    width: "100%",
    height: "100%",
  },
  carouselItemOutfit: {
    width: width * 0.38,
    height: width * 0.5,
    marginRight: 10,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F5F0E6",
  },
  carouselImageOutfit: {
    width: "100%",
    height: "100%",
  },
  carouselItemInterior: {
    width: width * 0.6,
    height: width * 0.42,
    marginRight: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  carouselImageInterior: {
    width: "100%",
    height: "100%",
  },
  // Rituals
  ritualItem: {
    marginBottom: 12,
  },
  ritualTitle: {
    fontSize: 15,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    marginBottom: 4,
    paddingLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: BROWN_LIGHT + "25",
    marginHorizontal: 24,
    marginTop: 32,
    marginBottom: 16,
  },
  bottomCTA: {
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 24,
  },
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
  quizLinkContainer: {
    marginTop: 8,
  },
  quizLinkText: {
    fontSize: 15,
    fontFamily: "EBGaramond_400Regular",
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
});
