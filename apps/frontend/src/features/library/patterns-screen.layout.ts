import type { ViewportSize } from "@/shared/browser/viewport";

import { getPatternsScreenContent } from "./patterns-screen.content";

export function getPatternsScreenLayout(viewport: ViewportSize) {
  const { SCREEN_WIDTH, SCREEN_HEIGHT } = getPatternsScreenContent(viewport);
  const stylesLayout = {
    previewThumb: {
      width: (SCREEN_WIDTH - 48 - 24 - 8) / 2,
    },
    patternCard: {
      width: (SCREEN_WIDTH - 48 - 12) / 2,
    },
  };
  const viewerStylesLayout = {
    imageWrapper: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.7,
    },
    image: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.7,
    },
  };
  return { stylesLayout, viewerStylesLayout };
}
