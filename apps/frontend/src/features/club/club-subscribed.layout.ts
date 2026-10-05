import type { ViewportSize } from "@/shared/browser/viewport";

import { getClubSubscribedContent } from "./club-subscribed.content";

export function getClubSubscribedLayout(viewport: ViewportSize) {
  const { SCREEN_WIDTH } = getClubSubscribedContent(viewport);
  const stylesLayout = {
    bannerContainer: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH * 0.55,
    },
  };
  return { stylesLayout };
}
