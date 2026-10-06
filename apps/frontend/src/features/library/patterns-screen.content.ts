import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.7be3fc15eb2bb84f.jpg";

export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const BROWN_LIGHT = "#A0845C";
export const CREAM = "#FDF8F0";
export const OLIVE_BG = "#e4e0cd";
export const PATTERNS_HERO_URL =
  "/assets/responsive/4327bffa91b1-TRkGduziKBAAVhso.w1200.7942f7a28be49f80.jpg";
export interface PatternItem {
  id: string;
  title: string;
  imageUrl: string;
  description: string;
}
export const CHRISTMAS_PATTERNS: PatternItem[] = [
  {
    id: "holly",
    title: "Остролист",
    imageUrl:
      "/assets/responsive/18c14e47537e-EJllmcoOmdUexPyK.full.b418b1ee748ba069.jpg",
    description: "Лист × 4, ягодка × 3",
  },
  {
    id: "sock",
    title: "Носок",
    imageUrl:
      "/assets/responsive/958b97c139fc-kvcsayGSgtVcnjGN.full.e3dcaa7e76e1b9af.jpg",
    description: "Носок × 4, квадрат × 2",
  },
  {
    id: "star",
    title: "Звезда",
    imageUrl:
      "/assets/responsive/ded750bddbeb-HSvrSZijpbSHOLAN.full.fc2a96a7206bc037.jpg",
    description: "Звезда × 1, ромб × 5",
  },
  {
    id: "apple",
    title: "Яблоко",
    imageUrl:
      "/assets/responsive/9b32f7b0c8f1-ReabYqEbymjBrDEY.full.64f01b5bcbb261ad.jpg",
    description: "Яблоко × 1, лист × 2",
  },
];
export const LOSHADKA_COVER_URL =
  "/assets/responsive/f8a919017d4c-WDRmWxjeWyXWNrto.w900.ea6d6770802512b5.webp";
export const LOSHADKA_YANDEX_URL = "https://disk.yandex.ru/i/nDfsd5ptLO1xRA";

export function getPatternsScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = viewport;
  return { SCREEN_WIDTH, SCREEN_HEIGHT };
}
