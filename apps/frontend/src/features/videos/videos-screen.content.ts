import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const CREAM = "#FDF8F0";
export const CARD_H_PADDING = 20;

export const ROSE_W = 140;
export const ROSE_H = 180;
export const ROSE_TOP = 18;
export const ROSE_INSET = -20;
export const HEADER_MIN_HEIGHT = ROSE_TOP + ROSE_H - 16;

export function getVideosScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const CARD_WIDTH = SCREEN_WIDTH - CARD_H_PADDING * 2;
  const THUMBNAIL_HEIGHT = CARD_WIDTH * (9 / 16);
  return { SCREEN_WIDTH, CARD_WIDTH, THUMBNAIL_HEIGHT };
}
