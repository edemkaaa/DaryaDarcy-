/** Геометрия страницы воспроизведения рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getVideoScreenContent } from "./video-screen.content";

export function getVideoScreenLayout(viewport: ViewportSize) {
  const { SCREEN_WIDTH, VIDEO_HEIGHT } = getVideoScreenContent(viewport);
  const stylesLayout = {
    videoContainer: {
      width: SCREEN_WIDTH,
      height: VIDEO_HEIGHT,
    },
  };
  return { stylesLayout };
}
