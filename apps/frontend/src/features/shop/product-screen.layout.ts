/** Геометрия карточки товара рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getProductScreenContent } from "./product-screen.content";

/** Передаём размеры обложки, превью и модального просмотра одной карточке товара. */
export function getProductScreenLayout(viewport: ViewportSize) {
  const { SCREEN_WIDTH, CAROUSEL_ITEM_WIDTH, CAROUSEL_ITEM_HEIGHT } =
    getProductScreenContent(viewport);
  const stylesLayout = {
    coverImage: {
      width: SCREEN_WIDTH * 0.72,
    },
    carouselItem: {
      width: CAROUSEL_ITEM_WIDTH,
      height: CAROUSEL_ITEM_HEIGHT,
    },
    zoomImage: {
      width: SCREEN_WIDTH - 32,
      height: SCREEN_WIDTH * 1.2,
    },
  };
  return { stylesLayout };
}
