import type { ViewportSize } from "@/shared/browser/viewport";

import { HOME_PROMO_ASPECT } from "@/features/home/promo-slides";
export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.7be3fc15eb2bb84f.jpg";

export const INTERVAL_MS = 6000;
export const FADE_MS = 2400;

export function getHomePromoCarouselContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const CARD_WIDTH = SCREEN_WIDTH - 48;
  const CARD_HEIGHT = Math.round(CARD_WIDTH * HOME_PROMO_ASPECT);
  return { SCREEN_WIDTH, CARD_WIDTH, CARD_HEIGHT };
}
