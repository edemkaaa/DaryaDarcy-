import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  FlatList,
  type ViewToken,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";

import Animated, {
  FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useQuiz } from "@/lib/quiz-state";
import { QUESTIONS } from "@/lib/quiz-data";
import { useColors } from "@/hooks/use-colors";

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const { width, height } = Dimensions.get("window");
const GRID_PADDING = 16;
const GRID_GAP = 6;

// Grid layout sizes (for landscape, animal, house questions)
const CARD_WIDTH_2 = (width - GRID_PADDING * 2 - GRID_GAP) / 2;
const CARD_WIDTH_3 = (width - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

// Swipe carousel dimensions (for outfits/artifacts — bigger)
const CAROUSEL_WIDTH = width - GRID_PADDING * 2;
const CAROUSEL_HEIGHT = height * 0.75;

// Warm milky color for text card backgrounds
const WARM_MILKY = "#FDF8F0";
const BROWN_TEXT = "#5C4033";

// Render answer text with **bold** and _italic_ markdown-like formatting
function RichAnswerText({ text, color, fontWeight }: { text: string; color: string; fontWeight: string }) {
  // Parse: split by **bold** and _italic_ markers
  const parts: { text: string; bold?: boolean; italic?: boolean }[] = [];
  const regex = /(\*\*(.+?)\*\*)|(_(.+?)_)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      // Bold
      parts.push({ text: match[2], bold: true });
    } else if (match[3]) {
      // Italic
      parts.push({ text: match[4], italic: true });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return (
    <Text style={{ fontSize: 15, lineHeight: 22, fontFamily: "EBGaramond_400Regular", color, fontWeight: fontWeight as any }}>
      {parts.map((p, i) => (
        <Text
          key={i}
          style={{
            fontFamily: p.bold ? "EBGaramond_700Bold" : p.italic ? "EBGaramond_400Regular_Italic" : "EBGaramond_400Regular",
            fontWeight: p.bold ? "700" : fontWeight as any,
          }}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

// Questions that use swipe carousel (outfits = id 3, artifacts = id 5)
const SWIPE_QUESTION_IDS = [3, 5];

export function QuizQuestion() {
  const { state, dispatch } = useQuiz();
  const colors = useColors();
  const question = QUESTIONS[state.currentQuestion];
  const selectedAnswer = state.answers[state.currentQuestion];
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const isSwipeQuestion = question.type === "visual" && SWIPE_QUESTION_IDS.includes(question.id);
  const isGridQuestion = question.type === "visual" && !SWIPE_QUESTION_IDS.includes(question.id);

  const handleSelect = useCallback(
    (answerId: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      dispatch({
        type: "ANSWER",
        questionIndex: state.currentQuestion,
        answerId,
      });
    },
    [state.currentQuestion, dispatch]
  );

  const handleNext = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    dispatch({ type: "NEXT_QUESTION" });
  }, [dispatch]);

  const handlePrev = useCallback(() => {
    dispatch({ type: "PREV_QUESTION" });
  }, [dispatch]);

  const progress = (state.currentQuestion + 1) / QUESTIONS.length;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  // Split answers into rows based on gridLayout or default 2-3-2
  const layout = question.gridLayout || [2, 3, 2];
  const row1 = isGridQuestion ? question.answers.slice(0, layout[0]) : [];
  const row2 = isGridQuestion ? question.answers.slice(layout[0], layout[0] + layout[1]) : [];
  const row3 = isGridQuestion ? question.answers.slice(layout[0] + layout[1], layout[0] + layout[1] + layout[2]) : [];


  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBg, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${progress * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: BROWN_TEXT }]}>
          {state.currentQuestion + 1} / {QUESTIONS.length}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        key={question.id}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          {/* Question title */}
          <Text style={[styles.questionTitle, { color: BROWN_TEXT }]}>
            {question.title}
          </Text>

          {/* Narrative */}
          <Text style={[styles.narrative, { color: BROWN_TEXT }]}>
            {question.narrative}
          </Text>

          {/* Optional header image */}
          {question.headerImage && (
            <View style={styles.headerImageContainer}>
              <Image
                source={question.headerImage}
                style={styles.headerImage}
                contentFit="contain"
              />
            </View>
          )}

          {/* Answers */}
          {isSwipeQuestion ? (
            /* === SWIPE CAROUSEL for outfits & artifacts === */
            <View style={styles.carouselContainer}>
              <FlatList
                ref={flatListRef}
                data={question.answers}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                renderItem={({ item: answer, index: i }) => (
                  <View style={styles.carouselSlide}>
                    <TouchableOpacity
                      style={[
                        styles.carouselCard,
                        selectedAnswer === answer.id && {
                          borderColor: colors.primary,
                          borderWidth: 3,
                          borderRadius: 16,
                        },
                      ]}
                      onPress={() => handleSelect(answer.id)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={answer.image}
                        style={styles.carouselImage}
                        contentFit="contain"
                      />
                      {selectedAnswer === answer.id && (
                        <View
                          style={[
                            styles.checkBadge,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Dots indicator - inside each slide so it scrolls with content */}
                    <View style={styles.dotsContainer}>
                      {question.answers.map((a, idx) => (
                        <View
                          key={a.id}
                          style={[
                            styles.dot,
                            {
                              backgroundColor:
                                idx === i
                                  ? colors.primary
                                  : selectedAnswer === a.id
                                  ? colors.primary + "80"
                                  : colors.border,
                            },
                            idx === i && styles.dotActive,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                )}
              />

              {/* Swipe hint */}
              <Text style={[styles.swipeHint, { color: BROWN_TEXT }]}>
                ← листай, чтобы увидеть все варианты →
              </Text>

            </View>
          ) : isGridQuestion ? (
            /* === GRID LAYOUT === */
            <View style={styles.visualContainer}>
              {[row1, row2, row3].map((row, rowIdx) => (
                <View key={rowIdx} style={styles.visualRow}>
                  {row.map((answer) => (
                    <TouchableOpacity
                      key={answer.id}
                      style={[
                        row.length === 1
                          ? styles.visualCardWide
                          : row.length === 2
                          ? styles.visualCard2
                          : styles.visualCard3,
                        selectedAnswer === answer.id && {
                          borderColor: colors.primary,
                          borderWidth: 3,
                        },
                      ]}
                      onPress={() => handleSelect(answer.id)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={answer.image}
                        style={styles.visualImage}
                        contentFit={row.length === 1 ? "cover" : "cover"}
                      />
                      {selectedAnswer === answer.id && (
                        <View
                          style={[
                            styles.gridCheckBadge,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            /* === TEXT ANSWERS === */
            <View style={styles.textAnswers}>
              {question.answers.map((answer) => (
                <TouchableOpacity
                  key={answer.id}
                  style={[
                    styles.textCard,
                    {
                      backgroundColor:
                        selectedAnswer === answer.id
                          ? colors.primary + "18"
                          : WARM_MILKY,
                      borderColor:
                        selectedAnswer === answer.id
                          ? colors.primary
                          : "#E8DFD4",
                      borderWidth: selectedAnswer === answer.id ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleSelect(answer.id)}
                  activeOpacity={0.8}
                >
                  <RichAnswerText
                    text={answer.text}
                    color={
                      selectedAnswer === answer.id
                        ? colors.primary
                        : BROWN_TEXT
                    }
                    fontWeight={selectedAnswer === answer.id ? "600" : "400"}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handlePrev}
          disabled={state.currentQuestion === 0}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.navButtonText,
              {
                color:
                  state.currentQuestion === 0
                    ? colors.border
                    : BROWN_TEXT,
                fontFamily: "EBGaramond_400Regular",
              },
            ]}
          >
            ← Назад
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor: selectedAnswer
                ? colors.primary
                : colors.surface,
            },
          ]}
          onPress={handleNext}
          disabled={!selectedAnswer}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.nextButtonText,
              {
                color: selectedAnswer ? "#fff" : colors.muted,
                fontFamily: "EBGaramond_700Bold",
              },
            ]}
          >
            {state.currentQuestion === QUESTIONS.length - 1
              ? "Узнать результат"
              : "Далее →"}
          </Text>
        </TouchableOpacity>
      </View>
      </ImageBackground>
  </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    fontFamily: "EBGaramond_400Regular",
  },
  scrollContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 24,
  },
  questionTitle: {
    fontSize: 24,
    fontFamily: "EBGaramond_700Bold",
    marginTop: 12,
    marginBottom: 8,
  },
  narrative: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "EBGaramond_400Regular_Italic",
    marginBottom: 12,
  },
  narrativeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 4,
  },
  narrativeWithImage: {
    flex: 1,
    marginBottom: 0,
  },
  sideImage: {
    width: 110,
    height: 120,
    marginTop: -30,
    marginLeft: -12,
  },
  headerImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  headerImage: {
    width: width * 0.4,
    height: width * 0.4,
  },
  // === SWIPE CAROUSEL styles (outfits/artifacts) ===
  carouselContainer: {
    marginHorizontal: -GRID_PADDING,
  },
  carouselSlide: {
    width: width,
    alignItems: "center",
  },
  carouselCard: {
    width: width,
    height: CAROUSEL_HEIGHT,
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 16,
    justifyContent: "flex-start",
    alignItems: "center",
    borderWidth: 0,
  },
  carouselImage: {
    width: width - 24,
    height: CAROUSEL_HEIGHT - 24,
  },
  checkBadge: {
    position: "absolute",
    top: 12,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  swipeHint: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "EBGaramond_400Regular_Italic",
    marginTop: 8,
  },
  // === GRID styles (landscape, animal, house) ===
  visualContainer: {
    gap: 4,
  },
  visualRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  visualCard2: {
    width: CARD_WIDTH_2,
    height: CARD_WIDTH_2 * 1.1,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 0,
  },
  visualCard3: {
    width: CARD_WIDTH_3,
    height: CARD_WIDTH_3,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 0,
  },
  visualCardWide: {
    width: width - GRID_PADDING * 2,
    height: (width - GRID_PADDING * 2) * 0.45,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 0,
  },
  visualImage: {
    width: "100%",
    height: "100%",
  },
  gridCheckBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // === TEXT ANSWER styles ===
  textAnswers: {
    gap: 10,
  },
  textCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  textAnswerText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "EBGaramond_400Regular",
  },
  // === NAVIGATION ===
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    gap: 12,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  navButtonText: {
    fontSize: 16,
  },
  nextButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  nextButtonText: {
    fontSize: 16,
  },
});
