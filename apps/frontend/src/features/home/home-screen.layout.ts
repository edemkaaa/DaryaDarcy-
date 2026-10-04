import type { ViewportSize } from "@/shared/browser/viewport";

import { getHomeScreenContent } from "./home-screen.content";

export function getHomeScreenLayout(viewport: ViewportSize) {
  const { SCREEN_WIDTH, HERO_HEIGHT } = getHomeScreenContent(viewport);
  const stylesLayout = {
    slideshowHeroContainer: {
      height: HERO_HEIGHT,
    },
    medallionOverlapContainer: {
      top: -SCREEN_WIDTH * 0.35,
      width: SCREEN_WIDTH * 0.55,
      height: SCREEN_WIDTH * 0.55,
    },
    glintStripe: {
      width: SCREEN_WIDTH * 0.55 * 0.35,
    },
    bookImageContainer: {
      width: SCREEN_WIDTH * 1.3,
      marginLeft: -SCREEN_WIDTH * 0.42,
    },
    stampImage: {
      width: SCREEN_WIDTH - 12,
    },
  };
  return { stylesLayout };
}
