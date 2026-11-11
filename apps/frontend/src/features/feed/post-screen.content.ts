/** Ресурсы и подписи детального поста отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";

export const CREAM_BG = "#FDF8F0";
export const BROWN_DARK = "#4A3728";
export const BROWN_LIGHT = "#7A6B5E";
export const GREEN_ACCENT = "#8B7355";

/** Оставляем совместимую точку получения ширины детального поста от общего viewport. */
export function getPostScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  return { SCREEN_WIDTH };
}
