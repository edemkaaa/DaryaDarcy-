"use client";
/** Открытый итог теста и клубное продолжение имеют разные источники данных; чтение гайда не выдаёт доступ само по себе. */
import { useViewport } from "@/shared/browser/viewport";

import { getQuizResultLayout } from "./quiz-result.layout";
import classes from "./quiz-result.module.scss";
import {
  Background,
  ScrollArea,
  Action,
  Typography,
} from "@/shared/ui/elements";
import { shareContent } from "@/shared/browser/actions";
import { ClubContentSection } from "./aesthetic-result-content";
import { useState, useEffect } from "react";
import { Picture } from "@/shared/media/image";
import { LinearGradient } from "@/shared/ui/gradient";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { useQuiz } from "@/domain/quiz/quiz-state";
import { useClub } from "@/domain/subscription/subscription-context";
import { AESTHETIC_NAMES, type AestheticKey } from "@/domain/quiz/quiz-data";

import { useRouter } from "@/shared/navigation/router";
import { useAestheticGuides } from "@/domain/library/private-library";
import { PrivateLibraryState } from "@/features/library/private-library-state";
import {
  PAPER_TEXTURE_URI,
  BROWN,
  BROWN_MUTED,
  HOUSE_IMAGES,
} from "./quiz-result.content";
/** Показываем бесплатный итог и по явному действию запрашиваем клубное продолжение выбранной эстетики. */
export function QuizResultScreen() {
  const router = useRouter();
  const viewport = useViewport();
  const { stylesLayout } = getQuizResultLayout(viewport);

  const { state, dispatch } = useQuiz();
  const { hasClubAccess } = useClub();
  const result = state.result;
  const [showClubContent, setShowClubContent] = useState(false);
  const [activeKey, setActiveKey] = useState<AestheticKey | null>(null);
  /** Сворачиваем клубное продолжение при потере доступа, не меняя бесплатный результат. */
  useEffect(() => {
    if (!hasClubAccess) setShowClubContent(false);
  }, [hasClubAccess]);
  const requestedKey = activeKey || result?.primary.key;
  const [guide] = useAestheticGuides(
    requestedKey ? [requestedKey] : [],
    showClubContent,
  );
  if (!result) return null;
  const { primary, secondary, isBlend, scores } = result;
  // Determine the active aesthetic (for blend tab switching)
  const currentKey = activeKey || primary.key;
  const activeResult =
    isBlend && secondary && currentKey === secondary.key ? secondary : primary;
  const houseImage = HOUSE_IMAGES[activeResult.key];
  const clubContent = guide?.data;
  /** Переключаем доминирующую или вторую эстетику и сбрасываем раскрытие, чтобы не показывать текст прежнего выбора. */
  const handleTabSwitch = (key: AestheticKey) => {
    if (key !== currentKey) {
      setActiveKey(key);
      setShowClubContent(false);
    }
  };
  /** Новый проход проходит через очередь QuizFlow, которая сохраняет его независимо от текущего экрана результата. */
  const handleRestart = () => {
    dispatch({ type: "RESTART" });
  };
  /** Передаём только текст выбранного бесплатного результата системному механизму обмена; отмена пользователем не меняет тест. */
  const handleShare = async () => {
    try {
      await shareContent({
        message: `Мой результат в тесте "Какая твоя сказка?" — ${AESTHETIC_NAMES[activeResult.key]}! ${activeResult.title}`,
      });
    } catch {}
  };
  /** У участницы раскрываем запрос гайда; гостя переводим к экрану доступа клуба. */
  const handleClubCTA = () => {
    if (hasClubAccess) {
      setShowClubContent(true);
    } else {
      // Navigate to club tab (subscription page)
      router.push("/club");
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
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea hideScrollbar contentClassName={classes.scrollContent}>
          {/* Blend Tab Switcher */}
          {isBlend && secondary && (
            <div
              className={["ui-stack ", classes.blendTabs]
                .filter(Boolean)
                .join(" ")}
            >
              <Action
                onClick={() => handleTabSwitch(primary.key)}
                activeOpacity={0.7}
                className={[
                  classes.blendTabActive,
                  currentKey === primary.key
                    ? classes.borderBottomColorState
                    : classes.borderBottomColorState2,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography
                  className={[
                    classes.blendTabTextActive,
                    currentKey === primary.key
                      ? classes.appearanceState
                      : classes.appearanceState2,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {AESTHETIC_NAMES[primary.key]}
                </Typography>
              </Action>
              <Action
                onClick={() => handleTabSwitch(secondary.key)}
                activeOpacity={0.7}
                className={[
                  classes.blendTabActive,
                  currentKey === secondary.key
                    ? classes.borderBottomColorState3
                    : classes.borderBottomColorState4,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography
                  className={[
                    classes.blendTabTextActive,
                    currentKey === secondary.key
                      ? classes.appearanceState3
                      : classes.appearanceState4,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {AESTHETIC_NAMES[secondary.key]}
                </Typography>
              </Action>
            </div>
          )}

          {/* Hero */}
          <div
            style={{
              width: stylesLayout.heroContainer.width,
              height: stylesLayout.heroContainer.height,
            }}
            className={["ui-stack ", classes.heroContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Picture
              source={houseImage}
              contentFit="cover"
              className={classes.heroImage}
            />
            <LinearGradient
              colors={["transparent", "rgba(20,15,10,0.9)"]}
              className={classes.gradient}
            />
            <div
              className={["ui-stack ", classes.heroOverlay]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.aestheticLabel}>
                {AESTHETIC_NAMES[activeResult.key]}
              </Typography>
              <Typography className={classes.heroTitle}>
                {activeResult.title}
              </Typography>
              {isBlend && secondary && (
                <Typography className={classes.blendLabel}>
                  с оттенком{" "}
                  {
                    AESTHETIC_NAMES[
                      currentKey === primary.key ? secondary.key : primary.key
                    ]
                  }
                </Typography>
              )}
            </div>
          </div>

          {/* Archetype */}
          <div className={["ui-stack ", classes.div].filter(Boolean).join(" ")}>
            <Typography className={classes.cardLabel}>Архетип</Typography>
            <Typography className={classes.cardValue}>
              {activeResult.archetype}
            </Typography>
          </div>

          {/* Fairy Tale */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionTitle}>
              Твоя сказка
            </Typography>
            <Typography className={classes.bodyText}>
              {activeResult.fairyTale}
            </Typography>
          </div>

          {/* Role Models */}
          {activeResult.roleModels ? (
            <div
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            >
              <Typography className={classes.cardLabel}>
                Ролевые модели
              </Typography>
              <Typography className={classes.cardValue}>
                {activeResult.roleModels}
              </Typography>
            </div>
          ) : null}

          {/* Depth */}
          {activeResult.depth ? (
            <div
              className={["ui-stack ", classes.section]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.sectionTitle}>Глубина</Typography>
              <Typography className={classes.bodyText}>
                {activeResult.depth}
              </Typography>
            </div>
          ) : null}

          {/* Score Breakdown */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionTitle}>
              Распределение баллов
            </Typography>
            <div
              className={["ui-stack ", classes.scoresContainer]
                .filter(Boolean)
                .join(" ")}
            >
              {sortedScores.map(({ key, score }) => (
                <div
                  key={key}
                  className={["ui-stack ", classes.scoreRow]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography
                    style={{
                      color: key === highlightKey ? BROWN : BROWN_MUTED,
                    }}
                    className={classes.typography}
                  >
                    {AESTHETIC_NAMES[key]}
                  </Typography>
                  <div
                    className={["ui-stack ", classes.scoreBarContainer]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div
                      className={["ui-stack ", classes.div2]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div
                        style={{
                          backgroundColor:
                            key === highlightKey ? BROWN : BROWN_MUTED + "60",
                          width:
                            maxScore > 0
                              ? `${(score / maxScore) * 100}%`
                              : "0%",
                        }}
                        className={["ui-stack ", classes.div3]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    </div>
                    <Typography className={classes.scoreValue}>
                      {score}
                    </Typography>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Club CTA Block */}
          {!showClubContent && (
            <div
              className={["ui-stack ", classes.clubCTA]
                .filter(Boolean)
                .join(" ")}
            >
              {hasClubAccess ? (
                <>
                  <Typography className={classes.clubCTAPrivilege}>
                    Вам доступен полный гид по вашей эстетике
                  </Typography>
                  <Typography className={classes.clubCTASubtext}>
                    Привилегия участницы Клуба Darcy
                  </Typography>
                </>
              ) : (
                <>
                  <Typography className={classes.clubCTAPrivilege}>
                    Узнать конкретные советы по стилю, интерьеру, ведению блога
                  </Typography>
                  <Typography className={classes.clubCTASubtext}>
                    Для участниц Клуба Darcy
                  </Typography>
                </>
              )}
              <Action
                onClick={handleClubCTA}
                activeOpacity={0.8}
                className={classes.action}
              >
                <Typography className={classes.clubCTAButtonText}>
                  {hasClubAccess ? "Читать" : "Вступить в клуб"}
                </Typography>
              </Action>
            </div>
          )}

          {/* Club Content (expanded) */}
          {showClubContent && hasClubAccess && !clubContent && (
            <PrivateLibraryState
              isLoading={guide?.isLoading ?? false}
              error={guide?.error}
              retry={() => guide?.retry()}
            />
          )}
          {showClubContent && hasClubAccess && clubContent && (
            <ClubContentSection
              content={clubContent}
              aestheticKey={activeResult.key}
            />
          )}

          {/* Actions */}
          <div
            className={["ui-stack ", classes.actionsContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={handleShare}
              activeOpacity={0.8}
              className={classes.action2}
            >
              <Typography className={classes.clubCTAButtonText}>
                Поделиться результатом
              </Typography>
            </Action>

            <Action
              onClick={handleRestart}
              activeOpacity={0.7}
              className={classes.action3}
            >
              <Typography className={classes.restartButtonText}>
                Пройти ещё раз
              </Typography>
            </Action>
          </div>
        </ScrollArea>
      </Background>
    </ScreenContainer>
  );
}
