/** Ресурсы и подписи страницы воспроизведения отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";

/** Задаём геометрию плеера 16:9 от ширины полотна приложения. */
export function getVideoScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const VIDEO_HEIGHT = SCREEN_WIDTH * (9 / 16);
  return { SCREEN_WIDTH, VIDEO_HEIGHT };
}
