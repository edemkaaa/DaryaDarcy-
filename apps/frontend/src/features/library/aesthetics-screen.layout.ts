/** Геометрия гайда эстетик рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getAestheticsScreenContent } from "./aesthetics-screen.content";

/** Задаём разные пропорции для образов, мудбордов и интерьеров; все размеры масштабируются от текущей ширины viewport. */
export function getAestheticsScreenLayout(viewport: ViewportSize) {
  const { width } = getAestheticsScreenContent(viewport);
  const stylesLayout = {
    heroContainer: {
      width: width,
      height: width * 0.6,
    },
    carouselItemOutfit: {
      width: width * 0.38,
      height: width * 0.5,
    },
    carouselItemMoodboard: {
      width: width * 0.4,
      height: width * 0.6,
    },
    carouselItemInterior: {
      width: width * 0.6,
      height: width * 0.42,
    },
  };
  return { stylesLayout };
}
