"use client";
/** Расширенный результат отображает проверенный гайд и набор иллюстраций отдельно от бесплатного подсчёта эстетики. */
import { useViewport } from "@/shared/browser/viewport";

import { getQuizResultLayout } from "./quiz-result.layout";
import classes from "./aesthetic-result-content.module.scss";

import { Typography, Collection } from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import { type AestheticKey } from "@/domain/quiz/quiz-data";
import type { AestheticGuideContent } from "@shared/aesthetic-guide";
import { formatInspirationList } from "@/domain/post/inspiration-titles";
import { useAestheticVisuals } from "@/features/library/use-aesthetic-visuals";
import { PrivateLibraryState } from "@/features/library/private-library-state";
import {
  COTTAGECORE_MOODBOARDS,
  COTTAGECORE_OUTFITS,
  COTTAGECORE_INTERIORS,
  DARKACADEMIA_OUTFITS,
  DARKACADEMIA_MOODBOARDS,
  DARKACADEMIA_INTERIORS,
  GOBLINCORE_OUTFITS,
  GOBLINCORE_MOODBOARDS,
  GOBLINCORE_INTERIORS,
  CASTLECORE_OUTFITS,
  CASTLECORE_MOODBOARDS,
  CASTLECORE_INTERIORS,
  WITCHCORE_OUTFITS,
  WITCHCORE_MOODBOARDS,
  WITCHCORE_INTERIORS,
  FAIRYCORE_OUTFITS,
  FAIRYCORE_MOODBOARDS,
  FAIRYCORE_INTERIORS,
  LIGHTACADEMIA_OUTFITS,
  LIGHTACADEMIA_MOODBOARDS,
  LIGHTACADEMIA_INTERIORS,
} from "./quiz-result.content";
export function ClubContentSection({
  content,
  aestheticKey,
}: {
  content: AestheticGuideContent;
  aestheticKey: AestheticKey;
}) {
  const viewport = useViewport();
  const { stylesLayout } = getQuizResultLayout(viewport);

  const publicMoodboards =
    aestheticKey === "cottagecore"
      ? COTTAGECORE_MOODBOARDS
      : aestheticKey === "darkAcademia"
        ? DARKACADEMIA_MOODBOARDS
        : aestheticKey === "goblincore"
          ? GOBLINCORE_MOODBOARDS
          : aestheticKey === "castlecore"
            ? CASTLECORE_MOODBOARDS
            : aestheticKey === "witchcore"
              ? WITCHCORE_MOODBOARDS
              : aestheticKey === "fairycore"
                ? FAIRYCORE_MOODBOARDS
                : aestheticKey === "lightAcademia"
                  ? LIGHTACADEMIA_MOODBOARDS
                  : [];
  const publicOutfits =
    aestheticKey === "cottagecore"
      ? COTTAGECORE_OUTFITS
      : aestheticKey === "darkAcademia"
        ? DARKACADEMIA_OUTFITS
        : aestheticKey === "goblincore"
          ? GOBLINCORE_OUTFITS
          : aestheticKey === "castlecore"
            ? CASTLECORE_OUTFITS
            : aestheticKey === "witchcore"
              ? WITCHCORE_OUTFITS
              : aestheticKey === "fairycore"
                ? FAIRYCORE_OUTFITS
                : aestheticKey === "lightAcademia"
                  ? LIGHTACADEMIA_OUTFITS
                  : [];
  const publicInteriors =
    aestheticKey === "cottagecore"
      ? COTTAGECORE_INTERIORS
      : aestheticKey === "darkAcademia"
        ? DARKACADEMIA_INTERIORS
        : aestheticKey === "goblincore"
          ? GOBLINCORE_INTERIORS
          : aestheticKey === "castlecore"
            ? CASTLECORE_INTERIORS
            : aestheticKey === "witchcore"
              ? WITCHCORE_INTERIORS
              : aestheticKey === "fairycore"
                ? FAIRYCORE_INTERIORS
                : aestheticKey === "lightAcademia"
                  ? LIGHTACADEMIA_INTERIORS
                  : [];
  const [visuals] = useAestheticVisuals([
    {
      key: aestheticKey,
      moodboards: publicMoodboards,
      outfits: publicOutfits,
      interiors: publicInteriors,
    },
  ]);
  if (!visuals.data)
    return (
      <PrivateLibraryState
        isLoading={visuals.isPending}
        error={visuals.error}
        retry={visuals.retry}
      />
    );
  const { moodboards, outfits, interiors } = visuals.data;
  return (
    <div
      className={["ui-stack ", classes.clubContent].filter(Boolean).join(" ")}
    >
      {/* Style Section */}
      <div className={["ui-stack ", classes.section].filter(Boolean).join(" ")}>
        <Typography className={classes.clubSectionTitle}>СТИЛЬ</Typography>
        <Typography className={classes.bodyText}>
          {content.style.intro}
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
              <Typography className={classes.styleTableHeaderText}>
                {aestheticKey === "darkAcademia"
                  ? "Академическое настроение"
                  : aestheticKey === "goblincore"
                    ? "Практичное"
                    : aestheticKey === "castlecore"
                      ? "Величественное"
                      : aestheticKey === "witchcore"
                        ? "Мистическое"
                        : aestheticKey === "fairycore"
                          ? "Нежное"
                          : aestheticKey === "lightAcademia"
                            ? "Силуэты"
                            : "Романтическое"}
              </Typography>
            </div>
            <div
              className={["ui-stack ", classes.styleTableHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.styleTableHeaderText}>
                {aestheticKey === "darkAcademia"
                  ? "Романтическое настроение"
                  : aestheticKey === "goblincore"
                    ? "Игривое"
                    : aestheticKey === "castlecore"
                      ? "Женственное"
                      : aestheticKey === "witchcore"
                        ? "Природное"
                        : aestheticKey === "fairycore"
                          ? "Дерзкое"
                          : aestheticKey === "lightAcademia"
                            ? "Детали"
                            : "Рабочее"}
              </Typography>
            </div>
          </div>
          {content.style.table.romantic.map((item, i) => (
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
                <Typography className={classes.styleTableCellText}>
                  {item}
                </Typography>
              </div>
              <div
                className={["ui-stack ", classes.styleTableCell]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.styleTableCellText}>
                  {content.style.table.workwear[i] || ""}
                </Typography>
              </div>
            </div>
          ))}
        </div>

        {/* Outfits (items without background) — always shown first after table */}
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
              keyExtractor={(_, i) => `outfit-${i}`}
              renderItem={({ item }) => (
                <div
                  style={{
                    width: stylesLayout.carouselItemOutfit.width,
                    height: stylesLayout.carouselItemOutfit.height,
                  }}
                  className={["ui-stack ", classes.carouselItemOutfit]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Picture
                    source={item}
                    contentFit="contain"
                    className={classes.carouselImageOutfit}
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
            {aestheticKey === "lightAcademia"
              ? "Основа гардероба: "
              : "Контраст: "}
          </Typography>
          {content.style.contrast}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>Детали: </Typography>
          {content.style.details}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>Аксессуары: </Typography>
          {content.style.accessories}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>Обувь: </Typography>
          {content.style.shoes}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>Ткани: </Typography>
          {content.style.fabrics}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>Цвета: </Typography>
          {content.style.colors}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>Бонус: </Typography>
          {content.style.bonus}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>Принцип: </Typography>
          {content.style.principle}
        </Typography>
        <Typography className={classes.typography}>
          <Typography className={classes.italicLabel}>
            Сочетание с другими эстетиками:{" "}
          </Typography>
          {content.style.mixing}
        </Typography>

        {/* Moodboards (looks with rounded corners) — always shown last in style section */}
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
              keyExtractor={(_, i) => `moodboard-${i}`}
              renderItem={({ item }) => (
                <div
                  style={{
                    width: stylesLayout.carouselItemMoodboard.width,
                    height: stylesLayout.carouselItemMoodboard.height,
                  }}
                  className={["ui-stack ", classes.carouselItemMoodboard]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Picture
                    source={item}
                    contentFit="cover"
                    className={classes.carouselImageOutfit}
                  />
                </div>
              )}
              contentClassName={classes.carouselList}
            />
          </div>
        )}
      </div>

      {/* Space Section */}
      <div className={["ui-stack ", classes.section].filter(Boolean).join(" ")}>
        <Typography className={classes.clubSectionTitle}>
          ПРОСТРАНСТВО
        </Typography>
        <Typography className={classes.bodyText}>
          {content.space.intro}
        </Typography>
        {content.space.finishing ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Отделка: </Typography>
            {content.space.finishing}
          </Typography>
        ) : null}
        {content.space.wallpaperBrands ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Обои: </Typography>
            {content.space.wallpaperBrands}
          </Typography>
        ) : null}
        {content.space.ceilings ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Потолки: </Typography>
            {content.space.ceilings}
          </Typography>
        ) : null}
        {content.space.importantNote ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Важно: </Typography>
            {content.space.importantNote}
          </Typography>
        ) : null}
        {content.space.palette ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Палитра: </Typography>
            {content.space.palette}
          </Typography>
        ) : null}
        {content.space.lifehack ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Лайфхак: </Typography>
            {content.space.lifehack}
          </Typography>
        ) : null}
        {content.space.furniture ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Мебель: </Typography>
            {content.space.furniture}
          </Typography>
        ) : null}
        {content.space.furnitureWhere ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>
              Где искать:{" "}
            </Typography>
            {content.space.furnitureWhere}
          </Typography>
        ) : null}
        {content.space.furnitureAvoid ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Избегать: </Typography>
            {content.space.furnitureAvoid}
          </Typography>
        ) : null}
        {content.space.textile ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Текстиль: </Typography>
            {content.space.textile}
          </Typography>
        ) : null}
        {content.space.textileFormula ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Формула: </Typography>
            {content.space.textileFormula}
          </Typography>
        ) : null}
        {content.space.details ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Детали: </Typography>
            {content.space.details}
          </Typography>
        ) : null}
        {content.space.lighting ? (
          <Typography className={classes.bodyText}>
            <Typography className={classes.italicLabel}>Освещение: </Typography>
            {content.space.lighting}
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
              keyExtractor={(_, i) => `interior-${i}`}
              renderItem={({ item }) => (
                <div
                  style={{
                    width: stylesLayout.carouselItemInterior.width,
                    height: stylesLayout.carouselItemInterior.height,
                  }}
                  className={["ui-stack ", classes.carouselItemInterior]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Picture
                    source={item}
                    contentFit="cover"
                    className={classes.carouselImageOutfit}
                  />
                </div>
              )}
              contentClassName={classes.carouselList}
            />
          </div>
        )}
      </div>

      {/* Rituals Section */}
      <div className={["ui-stack ", classes.section].filter(Boolean).join(" ")}>
        <Typography className={classes.clubSectionTitle}>РИТУАЛЫ</Typography>
        {content.rituals.items.map((ritual, i) => (
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

      {/* Blog Section */}
      <div className={["ui-stack ", classes.section].filter(Boolean).join(" ")}>
        <Typography className={classes.clubSectionTitle}>БЛОГ</Typography>
        <Typography className={classes.bodyText}>
          {content.blog.intro}
        </Typography>
        <Typography className={classes.bodyText}>
          <Typography className={classes.italicLabel}>
            Сильная сторона:{" "}
          </Typography>
          {content.blog.strength}
        </Typography>
        <Typography className={classes.clubSubtitle}>Рубрики:</Typography>
        {content.blog.rubrics.map((rubric, i) => (
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
        <Typography className={classes.clubSubtitle}>Советы:</Typography>
        {content.blog.tips.map((tip, i) => (
          <Typography key={i} className={classes.tipText}>
            • {tip}
          </Typography>
        ))}
      </div>

      {/* Inspiration Section */}
      <div className={["ui-stack ", classes.section].filter(Boolean).join(" ")}>
        <Typography className={classes.clubSectionTitle}>
          ВДОХНОВЕНИЕ
        </Typography>

        <Typography className={classes.clubSubtitle}>Фильмы</Typography>
        <Typography className={classes.bodyText}>
          {formatInspirationList(content.inspiration.films)}
        </Typography>

        <Typography className={classes.clubSubtitle}>Сериалы</Typography>
        <Typography className={classes.bodyText}>
          {formatInspirationList(content.inspiration.series)}
        </Typography>

        <Typography className={classes.clubSubtitle}>Книги</Typography>
        <Typography className={classes.bodyText}>
          {formatInspirationList(content.inspiration.books)}
        </Typography>

        <Typography className={classes.clubSubtitle}>Музыка</Typography>
        <Typography className={classes.bodyText}>
          {content.inspiration.music.join(", ")}
        </Typography>

        <Typography className={classes.clubSubtitle}>Блоги</Typography>
        <Typography className={classes.bodyText}>
          IG: {content.inspiration.blogs.instagram.join(", ")}
        </Typography>
        <Typography className={classes.bodyText}>
          YouTube: {content.inspiration.blogs.youtube.join(", ")}
        </Typography>

        <Typography className={classes.clubSubtitle}>Журналы</Typography>
        <Typography className={classes.bodyText}>
          {formatInspirationList(content.inspiration.magazines)}
        </Typography>
      </div>
    </div>
  );
}
