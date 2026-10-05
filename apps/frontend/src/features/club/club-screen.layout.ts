import type { ViewportSize } from "@/shared/browser/viewport";

import { getClubScreenContent } from "./club-screen.content";

export function getClubScreenLayout(viewport: ViewportSize) {
  const { SCREEN_WIDTH } = getClubScreenContent(viewport);
  const stylesLayout = {
    exclusiveCarouselSlide: {
      width: SCREEN_WIDTH * 0.7,
    },
    giveawayCarouselSlide: {
      width: SCREEN_WIDTH * 0.75,
    },
    communityCarouselSlide: {
      width: SCREEN_WIDTH * 0.75,
    },
    letterCarouselSlide: {
      width: SCREEN_WIDTH * 0.4,
    },
    reviewCarouselSlide: {
      width: SCREEN_WIDTH * 0.75,
    },
  };
  return { stylesLayout };
}
