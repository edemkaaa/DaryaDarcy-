import type { ViewportSize } from "@/shared/browser/viewport";

export function getAdminScreenLayout(viewport: ViewportSize) {
  const stylesLayout = {
    previewCarouselPhoto: {
      width: viewport.width - 64,
    },
  };
  return { stylesLayout };
}
