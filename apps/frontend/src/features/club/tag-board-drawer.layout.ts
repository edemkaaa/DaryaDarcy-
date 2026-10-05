import type { ViewportSize } from "@/shared/browser/viewport";

import { getTagBoardDrawerContent } from "./tag-board-drawer.content";

export function getTagBoardDrawerLayout(viewport: ViewportSize) {
  const {
    DRAWER_WIDTH,
    DRAWER_TOP_OFFSET,
    BOARD_WIDTH,
    BOARD_LEFT,
    BOARD_HEIGHT,
    BOARD_LINEN_TOP,
    BOARD_LINEN_SIDE,
    BOARD_LINEN_HEIGHT,
    TAG_GRID_TOP_PADDING,
  } = getTagBoardDrawerContent(viewport);
  const stylesLayout = {
    peekStrip: {
      top: DRAWER_TOP_OFFSET + 60,
    },
    drawer: {
      top: DRAWER_TOP_OFFSET,
      width: DRAWER_WIDTH,
    },
    boardFrame: {
      left: BOARD_LEFT,
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
    },
    boardImage: {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
    },
    drawerContent: {
      top: BOARD_LINEN_TOP,
      left: BOARD_LINEN_SIDE,
      right: BOARD_LINEN_SIDE,
      height: BOARD_LINEN_HEIGHT,
      paddingTop: TAG_GRID_TOP_PADDING,
    },
  };
  return { stylesLayout };
}
