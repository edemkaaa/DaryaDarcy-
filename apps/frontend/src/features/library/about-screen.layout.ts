/** Геометрия страницы об авторе рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getAboutScreenContent } from "./about-screen.content";

/** Одна страница фотокарусели занимает полную ширину viewport, совпадая с шагом горизонтального листания. */
export function getAboutScreenLayout(viewport: ViewportSize) {
  const { width } = getAboutScreenContent(viewport);
  const stylesLayout = {
    carouselItem: {
      width: width,
    },
  };
  return { stylesLayout };
}
