import type { ViewportSize } from "@/shared/browser/viewport";

import { getClubSubscribedContent } from "./club-subscribed.content";

export function getClubSubscribedLayout(
  viewport: ViewportSize,
  bannerSize?: { width: number; height: number } | null,
) {
  const { SCREEN_WIDTH } = getClubSubscribedContent(viewport);
  const stylesLayout = {
    bannerContainer: {
      width: SCREEN_WIDTH,
      height: bannerSize
        ? (SCREEN_WIDTH * bannerSize.height) / bannerSize.width
        : SCREEN_WIDTH * 0.55,
    },
  };
  return { stylesLayout };
}
