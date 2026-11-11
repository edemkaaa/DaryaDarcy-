/** Геометрия результата теста рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getQuizResultContent } from "./quiz-result.content";

export function getQuizResultLayout(viewport: ViewportSize) {
  const { width } = getQuizResultContent(viewport);
  const stylesLayout = {
    carouselItemOutfit: {
      width: width * 0.42,
      height: width * 0.56,
    },
    carouselItemMoodboard: {
      width: width * 0.45,
      height: width * 0.67,
    },
    carouselItemInterior: {
      width: width * 0.7,
      height: width * 0.5,
    },
    heroContainer: {
      width: width,
      height: width * 0.85,
    },
  };
  return { stylesLayout };
}
