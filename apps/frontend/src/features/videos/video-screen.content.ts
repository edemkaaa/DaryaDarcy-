import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.7be3fc15eb2bb84f.jpg";

export function getVideoScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const VIDEO_HEIGHT = SCREEN_WIDTH * (9 / 16);
  return { SCREEN_WIDTH, VIDEO_HEIGHT };
}
