import type { ViewportSize } from "@/shared/browser/viewport";

import { getVideosScreenContent } from "./videos-screen.content";

export function getVideosScreenLayout(viewport: ViewportSize) {
  const { THUMBNAIL_HEIGHT } = getVideosScreenContent(viewport);
  const stylesLayout = {
    thumbnailContainer: {
      height: THUMBNAIL_HEIGHT,
    },
  };
  return { stylesLayout };
}
