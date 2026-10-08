"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getAestheticsScreenLayout } from "./aesthetics-screen.layout";
import classes from "./aesthetics-screen.module.scss";

import {
  Background,
  ScrollArea,
  Action,
  Typography,
  MeasuredBox,
  Collection,
} from "@/shared/ui/elements";
import { useRef } from "react";
import { Picture } from "@/shared/media/image";
import { LinearGradient } from "@/shared/ui/gradient";
import { BlurView } from "@/shared/ui/blur";
import { ScreenContainer } from "@/shared/ui/screen-container";

import { useRouter } from "@/shared/navigation/router";
import { useClub } from "@/domain/subscription/subscription-context";
import {
  AESTHETIC_NAMES,
  AESTHETIC_RESULTS,
  type AestheticKey,
} from "@/domain/quiz/quiz-data";
import {
  COTTAGECORE_RESULT,
  type CottagecoreResultContent,
} from "@/domain/quiz/content/cottagecore-result";
import { DARK_ACADEMIA_RESULT } from "@/domain/quiz/content/darkacademia-result";
import { GOBLINCORE_RESULT } from "@/domain/quiz/content/goblincore-result";
import { CASTLECORE_RESULT } from "@/domain/quiz/content/castlecore-result";
import { WITCHCORE_RESULT } from "@/domain/quiz/content/witchcore-result";
import { FAIRYCORE_RESULT } from "@/domain/quiz/content/fairycore-result";
import { LIGHT_ACADEMIA_RESULT } from "@/domain/quiz/content/lightacademia-result";
import { formatInspirationList } from "@/domain/post/inspiration-titles";
import {
  PAPER_TEXTURE_URI,
  AESTHETIC_ORDER,
  HOUSE_IMAGES,
  MOODBOARDS,
  OUTFITS,
  INTERIORS,
} from "./aesthetics-screen.content";
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
function getTableHeaders(key: AestheticKey): [string, string] {
  switch (key) {
    case "darkAcademia":
      return ["Академическое настроение", "Романтическое настроение"];
    case "goblincore":
      return ["Практичное", "Игривое"];
    case "castlecore":
      return ["Величественное", "Женственное"];
    case "witchcore":
      return ["Мистическое", "Природное"];
    case "fairycore":
      return ["Нежное", "Дерзкое"];
    case "lightAcademia":
      return ["Силуэты", "Детали"];
    default:
      return ["Романтическое", "Рабочее"];
  }
}
export default function AestheticsGuideScreen() {
  const router = useRouter();
  const viewport = useViewport();
  const { stylesLayout } = getAestheticsScreenLayout(viewport);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isSubscribed } = useClub();
  const handleBack = () => {
    router.back();
  };
  const handleQuizCTA = () => {
    router.push("/quiz");
  };
  const handleClubCTA = () => {
    router.push("/club");
  };
  // Scroll to section by index
  const sectionRefs = useRef<Record<string, number>>({});
  const scrollToSection = (key: AestheticKey) => {
    const y = sectionRefs.current[key];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ top: y - 20, behavior: "smooth" });
    }
  };
  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea
          ref={scrollRef}
          hideScrollbar
          contentClassName={classes.scrollContent}
        >
          {/* Banner Header */}
          <div
            className={["ui-stack ", classes.bannerContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Picture
              source={{
                uri: "/assets/responsive/47ae04f69998-VjKNaGyYogjUkMPQ.w1200.f931112dad472e7c.webp",
              }}
              contentFit="cover"
              className={classes.bannerImage}
            />
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

              {/* Blurred TOC Preview */}
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
                  <Typography className={classes.tocTitle}>
                    ОГЛАВЛЕНИЕ
                  </Typography>
                  {AESTHETIC_ORDER.map((key, index) => (
                    <div
                      key={key}
                      className={["ui-stack ", classes.tocItem]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Typography className={classes.tocNumber}>
                        {index + 1}.
                      </Typography>
                      <Typography className={classes.tocName}>
                        {AESTHETIC_NAMES[key]}
                      </Typography>
                    </div>
                  ))}
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
              {/* CTA Buttons */}
              <div
                className={["ui-stack ", classes.ctaContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Action
                  onClick={handleQuizCTA}
                  activeOpacity={0.8}
                  className={classes.ctaButtonOlive}
                >
                  <Typography className={classes.ctaButtonOliveText}>
                    Определить свою эстетику →
                  </Typography>
                </Action>
              </div>

              {/* Table of Contents */}
              <div
                className={["ui-stack ", classes.tocContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.tocTitle}>ОГЛАВЛЕНИЕ</Typography>
                {AESTHETIC_ORDER.map((key, index) => (
                  <Action
                    key={key}
                    onClick={() => scrollToSection(key)}
                    activeOpacity={0.7}
                    className={classes.tocItem}
                  >
                    <Typography className={classes.tocNumber}>
                      {index + 1}.
                    </Typography>
                    <Typography className={classes.tocName}>
                      {AESTHETIC_NAMES[key]}
                    </Typography>
                  </Action>
                ))}
              </div>
            </>
          )}

          {/* Aesthetic Sections (only for subscribers) */}
          {isSubscribed &&
            AESTHETIC_ORDER.map((key) => {
              const result = AESTHETIC_RESULTS[key];
              const clubContent = getClubContent(key);
              const moodboards = MOODBOARDS[key];
              const outfits = OUTFITS[key];
              const interiors = INTERIORS[key];
              const [header1, header2] = getTableHeaders(key);
              return (
                <MeasuredBox
                  key={key}
                  onResize={(e) => {
                    sectionRefs.current[key] = e.y;
                  }}
                  className={classes.aestheticSection}
                >
                  {/* Hero Image */}
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
                      source={HOUSE_IMAGES[key]}
                      contentFit="cover"
                      className={classes.bannerImage}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(20,15,10,0.85)"]}
                      className={classes.gradient}
                    />
                    <div
                      className={["ui-stack ", classes.heroOverlay]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Typography className={classes.aestheticLabel}>
                        {AESTHETIC_NAMES[key]}
                      </Typography>
                      <Typography className={classes.heroTitle}>
                        {result.title}
                      </Typography>
                    </div>
                  </div>

                  {/* Free Content */}
                  <div
                    className={["ui-stack ", classes.section]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.sectionTitle}>
                      Архетип
                    </Typography>
                    <Typography className={classes.bodyText}>
                      {result.archetype}
                    </Typography>
                  </div>

                  <div
                    className={["ui-stack ", classes.section]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.sectionTitle}>
                      Твоя сказка
                    </Typography>
                    <Typography className={classes.bodyText}>
                      {result.fairyTale}
                    </Typography>
                  </div>

                  {result.roleModels ? (
                    <div
                      className={["ui-stack ", classes.section]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Typography className={classes.sectionTitle}>
                        Ролевые модели
                      </Typography>
                      <Typography className={classes.bodyText}>
                        {result.roleModels}
                      </Typography>
                    </div>
                  ) : null}

                  {result.depth ? (
                    <div
                      className={["ui-stack ", classes.section]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Typography className={classes.sectionTitle}>
                        Глубина
                      </Typography>
                      <Typography className={classes.bodyText}>
                        {result.depth}
                      </Typography>
                    </div>
                  ) : null}

                  {/* Premium Content (Club only) */}
                  {isSubscribed && clubContent && (
                    <>
                      {/* СТИЛЬ */}
                      <div
                        className={["ui-stack ", classes.section]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Typography className={classes.clubSectionTitle}>
                          СТИЛЬ
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {clubContent.style.intro}
                        </Typography>

                        {/* Style Table */}
                        <div
                          className={["ui-stack ", classes.styleTable]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <div
                            className={["ui-stack ", classes.styleTableRow]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <div
                              className={["ui-stack ", classes.styleTableHeader]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <Typography
                                className={classes.styleTableHeaderText}
                              >
                                {header1}
                              </Typography>
                            </div>
                            <div
                              className={["ui-stack ", classes.styleTableHeader]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <Typography
                                className={classes.styleTableHeaderText}
                              >
                                {header2}
                              </Typography>
                            </div>
                          </div>
                          {clubContent.style.table.romantic.map((item, i) => (
                            <div
                              key={i}
                              className={["ui-stack ", classes.styleTableRow]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <div
                                className={["ui-stack ", classes.styleTableCell]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <Typography
                                  className={classes.styleTableCellText}
                                >
                                  {item}
                                </Typography>
                              </div>
                              <div
                                className={["ui-stack ", classes.styleTableCell]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <Typography
                                  className={classes.styleTableCellText}
                                >
                                  {clubContent.style.table.workwear[i] || ""}
                                </Typography>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Outfits Carousel */}
                        {outfits.length > 0 && (
                          <div
                            className={["ui-stack ", classes.carouselContainer]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Collection
                              data={outfits}
                              horizontal
                              hideScrollbar
                              keyExtractor={(_, i) => `${key}-outfit-${i}`}
                              renderItem={({ item }) => (
                                <div
                                  style={{
                                    width:
                                      stylesLayout.carouselItemOutfit.width,
                                    height:
                                      stylesLayout.carouselItemOutfit.height,
                                  }}
                                  className={[
                                    "ui-stack ",
                                    classes.carouselItemOutfit,
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  <Picture
                                    source={item}
                                    contentFit="contain"
                                    className={classes.bannerImage}
                                  />
                                </div>
                              )}
                              contentClassName={classes.carouselList}
                            />
                          </div>
                        )}

                        {/* Style Details */}
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            {key === "lightAcademia"
                              ? "Основа гардероба: "
                              : "Контраст: "}
                          </Typography>
                          {clubContent.style.contrast}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Детали:{" "}
                          </Typography>
                          {clubContent.style.details}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Аксессуары:{" "}
                          </Typography>
                          {clubContent.style.accessories}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Обувь:{" "}
                          </Typography>
                          {clubContent.style.shoes}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Ткани:{" "}
                          </Typography>
                          {clubContent.style.fabrics}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Цвета:{" "}
                          </Typography>
                          {clubContent.style.colors}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Бонус:{" "}
                          </Typography>
                          {clubContent.style.bonus}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Принцип:{" "}
                          </Typography>
                          {clubContent.style.principle}
                        </Typography>
                        <Typography className={classes.typography}>
                          <Typography className={classes.italicLabel}>
                            Сочетание с другими эстетиками:{" "}
                          </Typography>
                          {clubContent.style.mixing}
                        </Typography>

                        {/* Moodboards Carousel */}
                        {moodboards.length > 0 && (
                          <div
                            className={["ui-stack ", classes.carouselContainer]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Collection
                              data={moodboards}
                              horizontal
                              hideScrollbar
                              keyExtractor={(_, i) => `${key}-mood-${i}`}
                              renderItem={({ item }) => (
                                <div
                                  style={{
                                    width:
                                      stylesLayout.carouselItemMoodboard.width,
                                    height:
                                      stylesLayout.carouselItemMoodboard.height,
                                  }}
                                  className={[
                                    "ui-stack ",
                                    classes.carouselItemMoodboard,
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  <Picture
                                    source={item}
                                    contentFit="cover"
                                    className={classes.bannerImage}
                                  />
                                </div>
                              )}
                              contentClassName={classes.carouselList}
                            />
                          </div>
                        )}
                      </div>

                      {/* ПРОСТРАНСТВО */}
                      <div
                        className={["ui-stack ", classes.section]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Typography className={classes.clubSectionTitle}>
                          ПРОСТРАНСТВО
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {clubContent.space.intro}
                        </Typography>
                        {clubContent.space.finishing ? (
                          <Typography className={classes.bodyText}>
                            <Typography className={classes.italicLabel}>
                              Отделка:{" "}
                            </Typography>
                            {clubContent.space.finishing}
                          </Typography>
                        ) : null}
                        {clubContent.space.palette ? (
                          <Typography className={classes.bodyText}>
                            <Typography className={classes.italicLabel}>
                              Палитра:{" "}
                            </Typography>
                            {clubContent.space.palette}
                          </Typography>
                        ) : null}
                        {clubContent.space.furniture ? (
                          <Typography className={classes.bodyText}>
                            <Typography className={classes.italicLabel}>
                              Мебель:{" "}
                            </Typography>
                            {clubContent.space.furniture}
                          </Typography>
                        ) : null}
                        {clubContent.space.textile ? (
                          <Typography className={classes.bodyText}>
                            <Typography className={classes.italicLabel}>
                              Текстиль:{" "}
                            </Typography>
                            {clubContent.space.textile}
                          </Typography>
                        ) : null}
                        {clubContent.space.details ? (
                          <Typography className={classes.bodyText}>
                            <Typography className={classes.italicLabel}>
                              Детали:{" "}
                            </Typography>
                            {clubContent.space.details}
                          </Typography>
                        ) : null}
                        {clubContent.space.lighting ? (
                          <Typography className={classes.bodyText}>
                            <Typography className={classes.italicLabel}>
                              Освещение:{" "}
                            </Typography>
                            {clubContent.space.lighting}
                          </Typography>
                        ) : null}

                        {/* Interior Carousel */}
                        {interiors.length > 0 && (
                          <div
                            className={["ui-stack ", classes.carouselContainer]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Collection
                              data={interiors}
                              horizontal
                              hideScrollbar
                              keyExtractor={(_, i) => `${key}-int-${i}`}
                              renderItem={({ item }) => (
                                <div
                                  style={{
                                    width:
                                      stylesLayout.carouselItemInterior.width,
                                    height:
                                      stylesLayout.carouselItemInterior.height,
                                  }}
                                  className={[
                                    "ui-stack ",
                                    classes.carouselItemInterior,
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  <Picture
                                    source={item}
                                    contentFit="cover"
                                    className={classes.bannerImage}
                                  />
                                </div>
                              )}
                              contentClassName={classes.carouselList}
                            />
                          </div>
                        )}
                      </div>

                      {/* РИТУАЛЫ */}
                      <div
                        className={["ui-stack ", classes.section]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Typography className={classes.clubSectionTitle}>
                          РИТУАЛЫ
                        </Typography>
                        {clubContent.rituals.items.map((ritual, i) => (
                          <div
                            key={i}
                            className={["ui-stack ", classes.ritualItem]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Typography className={classes.ritualTitle}>
                              {ritual.title}
                            </Typography>
                            <Typography className={classes.bodyText}>
                              {ritual.description}
                            </Typography>
                          </div>
                        ))}
                      </div>

                      {/* БЛОГ */}
                      <div
                        className={["ui-stack ", classes.section]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Typography className={classes.clubSectionTitle}>
                          БЛОГ
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {clubContent.blog.intro}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          <Typography className={classes.italicLabel}>
                            Сильная сторона:{" "}
                          </Typography>
                          {clubContent.blog.strength}
                        </Typography>
                        <Typography className={classes.clubSubtitle}>
                          Рубрики:
                        </Typography>
                        {clubContent.blog.rubrics.map((rubric, i) => (
                          <div
                            key={i}
                            className={["ui-stack ", classes.ritualItem]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Typography className={classes.ritualTitle}>
                              {rubric.title}
                            </Typography>
                            <Typography className={classes.bodyText}>
                              {rubric.description}
                            </Typography>
                          </div>
                        ))}
                        <Typography className={classes.clubSubtitle}>
                          Советы:
                        </Typography>
                        {clubContent.blog.tips.map((tip, i) => (
                          <Typography key={i} className={classes.tipText}>
                            • {tip}
                          </Typography>
                        ))}
                      </div>

                      {/* ВДОХНОВЕНИЕ */}
                      <div
                        className={["ui-stack ", classes.section]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Typography className={classes.clubSectionTitle}>
                          ВДОХНОВЕНИЕ
                        </Typography>
                        <Typography className={classes.clubSubtitle}>
                          Фильмы
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {formatInspirationList(clubContent.inspiration.films)}
                        </Typography>
                        <Typography className={classes.clubSubtitle}>
                          Сериалы
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {formatInspirationList(
                            clubContent.inspiration.series,
                          )}
                        </Typography>
                        <Typography className={classes.clubSubtitle}>
                          Книги
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {formatInspirationList(clubContent.inspiration.books)}
                        </Typography>
                        <Typography className={classes.clubSubtitle}>
                          Музыка
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {clubContent.inspiration.music.join(", ")}
                        </Typography>
                        <Typography className={classes.clubSubtitle}>
                          Блоги
                        </Typography>
                        <Typography className={classes.bodyText}>
                          IG:{" "}
                          {clubContent.inspiration.blogs.instagram.join(", ")}
                        </Typography>
                        <Typography className={classes.bodyText}>
                          YouTube:{" "}
                          {clubContent.inspiration.blogs.youtube.join(", ")}
                        </Typography>
                        <Typography className={classes.clubSubtitle}>
                          Журналы
                        </Typography>
                        <Typography className={classes.bodyText}>
                          {formatInspirationList(
                            clubContent.inspiration.magazines,
                          )}
                        </Typography>
                      </div>
                    </>
                  )}

                  {/* Divider between aesthetics */}
                  <div
                    className={["ui-stack ", classes.divider]
                      .filter(Boolean)
                      .join(" ")}
                  />
                </MeasuredBox>
              );
            })}

          {/* Bottom CTA (only for subscribers) */}
          {isSubscribed && (
            <div
              className={["ui-stack ", classes.bottomCTA]
                .filter(Boolean)
                .join(" ")}
            >
              <Action
                onClick={handleQuizCTA}
                activeOpacity={0.8}
                className={classes.ctaButtonOlive}
              >
                <Typography className={classes.ctaButtonOliveText}>
                  Определить свою эстетику →
                </Typography>
              </Action>
            </div>
          )}
        </ScrollArea>
      </Background>
    </ScreenContainer>
  );
}
