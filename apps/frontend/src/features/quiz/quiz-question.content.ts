/** Ресурсы и подписи вопроса теста отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";

export const GRID_PADDING = 16;
export const GRID_GAP = 6;

export const WARM_MILKY = "#FDF8F0";
export const BROWN_TEXT = "#5C4033";
export const SWIPE_QUESTION_IDS = [3, 5];

/** Рассчитываем общую геометрию сетки и высокий формат слайдера из viewport; настройки строк остаются в данных вопроса. */
export function getQuizQuestionContent(viewport: ViewportSize) {
  const { width, height } = viewport;
  const CARD_WIDTH_2 = (width - GRID_PADDING * 2 - GRID_GAP) / 2;
  const CARD_WIDTH_3 = (width - GRID_PADDING * 2 - GRID_GAP * 2) / 3;
  const CAROUSEL_WIDTH = width - GRID_PADDING * 2;
  const CAROUSEL_HEIGHT = height * 0.75;
  return {
    width,
    height,
    CARD_WIDTH_2,
    CARD_WIDTH_3,
    CAROUSEL_WIDTH,
    CAROUSEL_HEIGHT,
  };
}
