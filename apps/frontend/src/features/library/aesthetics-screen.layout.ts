import type { ViewportSize } from "@/shared/browser/viewport";

import { getAestheticsScreenContent } from "./aesthetics-screen.content";

export function getAestheticsScreenLayout(viewport: ViewportSize) {
  const { width } = getAestheticsScreenContent(viewport);
  const stylesLayout = {
    heroContainer: {
      width: width,
      height: width * 0.6,
    },
    carouselItemOutfit: {
      width: width * 0.38,
      height: width * 0.5,
    },
    carouselItemMoodboard: {
      width: width * 0.4,
      height: width * 0.6,
    },
    carouselItemInterior: {
      width: width * 0.6,
      height: width * 0.42,
    },
  };
  return { stylesLayout };
}
