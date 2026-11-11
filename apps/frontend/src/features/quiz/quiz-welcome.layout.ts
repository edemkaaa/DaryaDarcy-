/** Геометрия приветствия теста рассчитывается из viewport отдельно от данных и обработчиков экрана. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { getQuizWelcomeContent } from "./quiz-welcome.content";

/** Сохраняем соотношение сторон коллажа при изменении ширины экрана. */
export function getQuizWelcomeLayout(viewport: ViewportSize) {
  const { width } = getQuizWelcomeContent(viewport);
  const stylesLayout = {
    collageContainer: {
      width: width,
      height: width * 0.72,
    },
  };
  return { stylesLayout };
}
