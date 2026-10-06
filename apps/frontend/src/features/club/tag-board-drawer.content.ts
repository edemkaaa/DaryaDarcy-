import type { ViewportSize } from "@/shared/browser/viewport";

import { TOPIC_TAGS } from "@/domain/post/post-tags";

export const PEEK_STRIP_WIDTH = 18;

export const BOARD_WIDTH_RATIO = 0.84;

export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const CREAM = "#FDF8F0";
export const TAG_BOARD_URI =
  "/assets/responsive/c2a4341558e8-dZtWbRtaJLWFOYGX.w1400.1ceb8381350df125.webp";
export const TOPIC_TAG_ROWS = [
  TOPIC_TAGS.slice(0, 5),
  TOPIC_TAGS.slice(5, 9),
  TOPIC_TAGS.slice(9, 13),
  TOPIC_TAGS.slice(13, 17),
  TOPIC_TAGS.slice(17, 21),
];
export const BOARD_IMG_ASPECT = 1536 / 2048;

export const LINEN_TOP_RATIO = 0.23;
export const LINEN_BOTTOM_RATIO = 0.2;
export const LINEN_SIDE_RATIO = 0.125;

export function getTagBoardDrawerContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = viewport;
  const DRAWER_WIDTH = SCREEN_WIDTH;
  const DRAWER_TOP_OFFSET = Math.round(SCREEN_HEIGHT * 0.23);
  const BOARD_WIDTH = Math.round(SCREEN_WIDTH * BOARD_WIDTH_RATIO);
  const BOARD_LEFT = Math.round((SCREEN_WIDTH - BOARD_WIDTH) / 2);
  const BOARD_HEIGHT = Math.round(BOARD_WIDTH * BOARD_IMG_ASPECT);
  const BOARD_LINEN_TOP = Math.round(BOARD_HEIGHT * LINEN_TOP_RATIO);
  const BOARD_LINEN_SIDE = Math.round(BOARD_WIDTH * LINEN_SIDE_RATIO);
  const BOARD_LINEN_HEIGHT = Math.round(
    BOARD_HEIGHT * (1 - LINEN_TOP_RATIO - LINEN_BOTTOM_RATIO),
  );
  const TAG_GRID_TOP_PADDING = Math.round(BOARD_LINEN_HEIGHT * 0.22);
  return {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    DRAWER_WIDTH,
    DRAWER_TOP_OFFSET,
    BOARD_WIDTH,
    BOARD_LEFT,
    BOARD_HEIGHT,
    BOARD_LINEN_TOP,
    BOARD_LINEN_SIDE,
    BOARD_LINEN_HEIGHT,
    TAG_GRID_TOP_PADDING,
  };
}
