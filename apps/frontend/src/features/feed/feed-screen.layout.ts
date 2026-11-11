/** Геометрия ленты рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getFeedScreenContent } from "./feed-screen.content";

/** Передаём вычисленные размеры сетки UI-компоненту без привязки к API или выбранному фильтру. */
export function getFeedScreenLayout(viewport: ViewportSize) {
  const { GRID_ITEM_SIZE, GRID_ITEM_HEIGHT } = getFeedScreenContent(viewport);
  const stylesLayout = {
    gridItem: {
      width: GRID_ITEM_SIZE,
      height: GRID_ITEM_HEIGHT,
    },
  };
  return { stylesLayout };
}
