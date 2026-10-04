import type { ViewportSize } from "@/shared/browser/viewport";

import { getHomePromoCarouselContent } from "./home-promo-carousel.content";

export function getHomePromoCarouselLayout(viewport: ViewportSize) {
  const { CARD_WIDTH, CARD_HEIGHT } = getHomePromoCarouselContent(viewport);
  const stylesLayout = {
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    },
  };
  return { stylesLayout };
}
