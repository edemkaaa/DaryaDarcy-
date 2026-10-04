import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";

export function getQuizWelcomeContent(viewport: ViewportSize) {
  const { width } = viewport;
  return { width };
}
