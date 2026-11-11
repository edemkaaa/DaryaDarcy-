"use client";
/** Экран вопроса передаёт выбранный answerId и номер вопроса модели теста; переход и запись прогресса выполняются владельцем потока. */
import { useViewport } from "@/shared/browser/viewport";

import { getQuizQuestionLayout } from "./quiz-question.layout";
import classes from "./quiz-question.module.scss";
import {
  Typography,
  type VisibleItem,
  Background,
  ScrollArea,
  Collection,
  Action,
} from "@/shared/ui/elements";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { Picture } from "@/shared/media/image";
import Animated, { FadeIn } from "@/shared/browser/motion";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { useQuiz } from "@/domain/quiz/quiz-state";
import { QUESTIONS } from "@/domain/quiz/quiz-data";
import { useColors } from "@/shared/styles/use-colors";
import {
  PAPER_TEXTURE_URI,
  WARM_MILKY,
  BROWN_TEXT,
  SWIPE_QUESTION_IDS,
} from "./quiz-question.content";
/** Разбираем только локальные маркеры жирного и курсива в тексте ответа; фрагменты остаются React-текстом без вставки HTML. */
function RichAnswerText({
  text,
  color,
  fontWeight,
}: {
  text: string;
  color: string;
  fontWeight: CSSProperties["fontWeight"];
}) {
  // Parse: split by **bold** and _italic_ markers
  const parts: {
    text: string;
    bold?: boolean;
    italic?: boolean;
  }[] = [];
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
    <Typography
      style={{ color: color, fontWeight: fontWeight }}
      className={classes.typography}
    >
      {parts.map((p, i) => (
        <Typography
          key={i}
          style={{
            fontWeight: p.bold ? "700" : fontWeight,
          }}
          className={
            p.bold
              ? classes.fontFamilyState
              : p.italic
                ? classes.fontFamilyState2
                : classes.fontFamilyState3
          }
        >
          {p.text}
        </Typography>
      ))}
    </Typography>
  );
}
/** Выбираем визуальный слайдер, сетку или текст по данным вопроса; сохранение и последовательность переходов делегированы потоку. */
export function QuizQuestion() {
  const viewport = useViewport();
  const { stylesLayout } = getQuizQuestionLayout(viewport);

  const { state, dispatch } = useQuiz();
  const colors = useColors();
  const question = QUESTIONS[state.currentQuestion];
  const selectedAnswer = state.answers[state.currentQuestion];
  const [, setCurrentIndex] = useState(0);
  const flatListRef = useRef<HTMLDivElement>(null);
  const isSwipeQuestion =
    question.type === "visual" && SWIPE_QUESTION_IDS.includes(question.id);
  const isGridQuestion =
    question.type === "visual" && !SWIPE_QUESTION_IDS.includes(question.id);
  /** Прикрепляем индекс вопроса к ответу, чтобы очередь смогла отклонить запоздалое нажатие. */
  const handleSelect = useCallback(
    (answerId: string) => {
      dispatch({
        type: "ANSWER",
        questionIndex: state.currentQuestion,
        answerId,
      });
    },
    [state.currentQuestion, dispatch],
  );
  /** Просим поток применить следующий шаг после проверки сохранённого ответа. */
  const handleNext = useCallback(() => {
    dispatch({ type: "NEXT_QUESTION" });
  }, [dispatch]);
  /** Возвращаемся к предыдущему вопросу через ту же последовательную очередь действий. */
  const handlePrev = useCallback(() => {
    dispatch({ type: "PREV_QUESTION" });
  }, [dispatch]);
  const progress = (state.currentQuestion + 1) / QUESTIONS.length;
  /** Запоминаем видимый индекс карусели; выбор ответа выполняется отдельным нажатием, а не самим листанием. */
  const onVisibleItemsChange = useCallback(
    ({ visibleItems }: { visibleItems: VisibleItem[] }) => {
      if (visibleItems.length > 0 && visibleItems[0].index != null) {
        setCurrentIndex(visibleItems[0].index);
      }
    },
    [],
  );
  const visiblePercent = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;
  // Split answers into rows based on gridLayout or default 2-3-2
  const layout = question.gridLayout || [2, 3, 2];
  const row1 = isGridQuestion ? question.answers.slice(0, layout[0]) : [];
  const row2 = isGridQuestion
    ? question.answers.slice(layout[0], layout[0] + layout[1])
    : [];
  const row3 = isGridQuestion
    ? question.answers.slice(
        layout[0] + layout[1],
        layout[0] + layout[1] + layout[2],
      )
    : [];
  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea
          hideScrollbar
          key={question.id}
          contentClassName={classes.scrollContent}
        >
          {/* Progress bar */}
          <div
            className={["ui-stack ", classes.progressContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            >
              <div
                style={{ width: `${progress * 100}%` }}
                className={["ui-stack ", classes.div2]
                  .filter(Boolean)
                  .join(" ")}
              />
            </div>
            <Typography className={classes.typography2}>
              {state.currentQuestion + 1} / {QUESTIONS.length}
            </Typography>
          </div>

          <Animated.div entering={FadeIn.duration(300)}>
            {/* Question title */}
            <Typography className={classes.typography3}>
              {question.title}
            </Typography>

            {/* Narrative */}
            <Typography className={classes.typography4}>
              {question.narrative}
            </Typography>

            {/* Optional header image */}
            {question.headerImage && (
              <div
                className={["ui-stack ", classes.headerImageContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Picture
                  source={question.headerImage}
                  style={{
                    width: stylesLayout.headerImage.width,
                    height: stylesLayout.headerImage.height,
                  }}
                  contentFit="contain"
                />
              </div>
            )}

            {/* Answers */}
            {isSwipeQuestion ? (
              /* === SWIPE CAROUSEL for outfits & artifacts === */
              <div
                className={["ui-stack ", classes.carouselContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Collection
                  ref={flatListRef}
                  data={question.answers}
                  horizontal
                  paging
                  hideScrollbar
                  keyExtractor={(item) => item.id}
                  onVisibleItemsChange={onVisibleItemsChange}
                  visiblePercent={
                    visiblePercent.viewAreaCoveragePercentThreshold
                  }
                  renderItem={({ item: answer, index: i }) => (
                    <div
                      style={{ width: stylesLayout.carouselSlide.width }}
                      className={["ui-stack ", classes.carouselSlide]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Action
                        style={{
                          width: stylesLayout.carouselCard.width,
                          height: stylesLayout.carouselCard.height,
                        }}
                        onClick={() => handleSelect(answer.id)}
                        aria-label={`Выбрать изображение ${i + 1}`}
                        aria-pressed={selectedAnswer === answer.id}
                        activeOpacity={0.9}
                        className={[
                          classes.action,
                          selectedAnswer === answer.id
                            ? classes.borderColorState
                            : "",
                          selectedAnswer === answer.id
                            ? classes.borderRadiusState
                            : "",
                          selectedAnswer === answer.id
                            ? classes.borderWidthState
                            : classes.borderWidthState2,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Picture
                          source={answer.image}
                          style={{
                            width: stylesLayout.carouselImage.width,
                            height: stylesLayout.carouselImage.height,
                          }}
                          contentFit="contain"
                        />
                        {selectedAnswer === answer.id && (
                          <div
                            className={["ui-stack ", classes.div3]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Typography className={classes.checkMark}>
                              ✓
                            </Typography>
                          </div>
                        )}
                      </Action>

                      {/* Dots indicator - inside each slide so it scrolls with content */}
                      <div
                        className={["ui-stack ", classes.dotsContainer]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {question.answers.map((a, idx) => (
                          <div
                            key={a.id}
                            style={{
                              backgroundColor:
                                idx === i
                                  ? colors.primary
                                  : selectedAnswer === a.id
                                    ? colors.primary + "80"
                                    : colors.border,
                            }}
                            className={[
                              "ui-stack ",
                              idx === i
                                ? classes.appearanceState
                                : classes.appearanceState2,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                />

                {/* Swipe hint */}
                <Typography className={classes.typography5}>
                  ← листай, чтобы увидеть все варианты →
                </Typography>
              </div>
            ) : isGridQuestion ? (
              /* === GRID LAYOUT === */
              <div
                className={["ui-stack ", classes.visualContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                {[row1, row2, row3].map((row, rowIdx) => (
                  <div
                    key={rowIdx}
                    className={["ui-stack ", classes.visualRow]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row.map((answer) => (
                      <Action
                        key={answer.id}
                        style={{
                          width:
                            row.length === 1
                              ? stylesLayout.visualCardWide.width
                              : row.length === 2
                                ? stylesLayout.visualCard2.width
                                : stylesLayout.visualCard3.width,
                          height:
                            row.length === 1
                              ? stylesLayout.visualCardWide.height
                              : row.length === 2
                                ? stylesLayout.visualCard2.height
                                : stylesLayout.visualCard3.height,
                        }}
                        onClick={() => handleSelect(answer.id)}
                        aria-label={`Выбрать изображение ${question.answers.indexOf(answer) + 1}`}
                        aria-pressed={selectedAnswer === answer.id}
                        activeOpacity={0.8}
                        className={[
                          selectedAnswer === answer.id
                            ? classes.borderColorState2
                            : "",
                          row.length === 1
                            ? classes.appearanceState3
                            : row.length === 2
                              ? classes.appearanceState4
                              : classes.appearanceState5,
                          selectedAnswer === answer.id
                            ? classes.borderWidthState3
                            : row.length === 1
                              ? classes.borderWidthState4
                              : row.length === 2
                                ? classes.borderWidthState5
                                : classes.borderWidthState6,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Picture
                          source={answer.image}
                          contentFit={row.length === 1 ? "cover" : "cover"}
                          className={classes.visualImage}
                        />
                        {selectedAnswer === answer.id && (
                          <div
                            className={["ui-stack ", classes.div4]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Typography className={classes.checkMark}>
                              ✓
                            </Typography>
                          </div>
                        )}
                      </Action>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              /* === TEXT ANSWERS === */
              <div
                className={["ui-stack ", classes.textAnswers]
                  .filter(Boolean)
                  .join(" ")}
              >
                {question.answers.map((answer) => (
                  <Action
                    key={answer.id}
                    style={{
                      backgroundColor:
                        selectedAnswer === answer.id
                          ? colors.primary + "18"
                          : WARM_MILKY,
                      borderColor:
                        selectedAnswer === answer.id
                          ? colors.primary
                          : "#E8DFD4",
                    }}
                    onClick={() => handleSelect(answer.id)}
                    aria-pressed={selectedAnswer === answer.id}
                    activeOpacity={0.8}
                    className={[
                      classes.action2,
                      selectedAnswer === answer.id
                        ? classes.borderWidthState7
                        : classes.borderWidthState8,
                    ]
                      .filter(Boolean)
                      .join(" ")}
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
                  </Action>
                ))}
              </div>
            )}
          </Animated.div>
        </ScrollArea>

        {/* Navigation */}
        <div
          data-background-notice-menu
          className={["ui-stack ", classes.div5].filter(Boolean).join(" ")}
        >
          <Action
            onClick={handlePrev}
            disabled={state.currentQuestion === 0}
            activeOpacity={0.7}
            className={classes.navButton}
          >
            <Typography
              style={{
                color: state.currentQuestion === 0 ? colors.border : BROWN_TEXT,
              }}
              className={classes.typography6}
            >
              ← Назад
            </Typography>
          </Action>

          <Action
            style={{
              backgroundColor: selectedAnswer ? colors.primary : colors.surface,
            }}
            onClick={handleNext}
            disabled={!selectedAnswer}
            activeOpacity={0.8}
            className={classes.action3}
          >
            <Typography
              style={{ color: selectedAnswer ? "#fff" : colors.muted }}
              className={classes.typography7}
            >
              {state.currentQuestion === QUESTIONS.length - 1
                ? "Узнать результат"
                : "Далее →"}
            </Typography>
          </Action>
        </div>
      </Background>
    </ScreenContainer>
  );
}
