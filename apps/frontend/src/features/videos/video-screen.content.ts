import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

export function getVideoScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const VIDEO_HEIGHT = SCREEN_WIDTH * (9 / 16);
  return { SCREEN_WIDTH, VIDEO_HEIGHT };
}
