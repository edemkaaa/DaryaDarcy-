import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

export const CREAM_BG = "#FDF8F0";
export const BROWN_DARK = "#4A3728";
export const BROWN_LIGHT = "#7A6B5E";
export const GREEN_ACCENT = "#8B7355";

export function getPostScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  return { SCREEN_WIDTH };
}
