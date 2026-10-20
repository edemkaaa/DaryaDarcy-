import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";

export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const BROWN_LIGHT = "#A0845C";
export const CREAM = "#FDF8F0";
export const OLIVE_BG = "#e4e0cd";
export const PATTERNS_HERO_URL =
  "/assets/responsive/4327bffa91b1-TRkGduziKBAAVhso.w1200.f8dbe5d9ca763eb2.webp";
export interface PatternItem {
  id: string;
  title: string;
  description: string;
}
export const CHRISTMAS_PATTERNS: PatternItem[] = [
  {
    id: "holly",
    title: "Остролист",
    description: "Лист × 4, ягодка × 3",
  },
  {
    id: "sock",
    title: "Носок",
    description: "Носок × 4, квадрат × 2",
  },
  {
    id: "star",
    title: "Звезда",
    description: "Звезда × 1, ромб × 5",
  },
  {
    id: "apple",
    title: "Яблоко",
    description: "Яблоко × 1, лист × 2",
  },
];
export const LOSHADKA_COVER_URL =
  "/assets/responsive/f8a919017d4c-WDRmWxjeWyXWNrto.w900.ea6d6770802512b5.webp";

export function getPatternsScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = viewport;
  return { SCREEN_WIDTH, SCREEN_HEIGHT };
}
