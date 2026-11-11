/** Геометрия списка видео рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getVideosScreenContent } from "./videos-screen.content";

/** Сводим расчёт превью к одному стилевому слоту, используемому обоими каталогами. */
export function getVideosScreenLayout(viewport: ViewportSize) {
  const { THUMBNAIL_HEIGHT } = getVideosScreenContent(viewport);
  const stylesLayout = {
    thumbnailContainer: {
      height: THUMBNAIL_HEIGHT,
    },
  };
  return { stylesLayout };
}
