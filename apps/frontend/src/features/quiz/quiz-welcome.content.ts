import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.7be3fc15eb2bb84f.jpg";
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";

export function getQuizWelcomeContent(viewport: ViewportSize) {
  const { width } = viewport;
  return { width };
}
