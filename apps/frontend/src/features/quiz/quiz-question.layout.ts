/** Геометрия вопроса теста рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";
import { GRID_PADDING } from "./quiz-question.content";
import { getQuizQuestionContent } from "./quiz-question.content";

export function getQuizQuestionLayout(viewport: ViewportSize) {
  const { width, CARD_WIDTH_2, CARD_WIDTH_3, CAROUSEL_HEIGHT } =
    getQuizQuestionContent(viewport);
  const stylesLayout = {
    headerImage: {
      width: width * 0.4,
      height: width * 0.4,
    },
    carouselSlide: {
      width: width,
    },
    carouselCard: {
      width: width,
      height: CAROUSEL_HEIGHT,
    },
    carouselImage: {
      width: width - 24,
      height: CAROUSEL_HEIGHT - 24,
    },
    visualCardWide: {
      width: width - GRID_PADDING * 2,
      height: (width - GRID_PADDING * 2) * 0.45,
    },
    visualCard2: {
      width: CARD_WIDTH_2,
      height: CARD_WIDTH_2 * 1.1,
    },
    visualCard3: {
      width: CARD_WIDTH_3,
      height: CARD_WIDTH_3,
    },
  };
  return { stylesLayout };
}
