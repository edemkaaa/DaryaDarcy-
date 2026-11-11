/** Геометрия промо-карусели главной рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getHomePromoCarouselContent } from "./home-promo-carousel.content";

/** Преобразуем рассчитанные размеры в стили карточки, не меняя данные слайдов или интервалы. */
export function getHomePromoCarouselLayout(viewport: ViewportSize) {
  const { CARD_WIDTH, CARD_HEIGHT } = getHomePromoCarouselContent(viewport);
  const stylesLayout = {
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    },
  };
  return { stylesLayout };
}
