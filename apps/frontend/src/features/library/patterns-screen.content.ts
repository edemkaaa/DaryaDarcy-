import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const BROWN_LIGHT = "#A0845C";
export const CREAM = "#FDF8F0";
export const OLIVE_BG = "#e4e0cd";
export const PATTERNS_HERO_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg";
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
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/18c14e47537e-EJllmcoOmdUexPyK.jpg",
    description: "Лист × 4, ягодка × 3",
  },
  {
    id: "sock",
    title: "Носок",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/958b97c139fc-kvcsayGSgtVcnjGN.jpg",
    description: "Носок × 4, квадрат × 2",
  },
  {
    id: "star",
    title: "Звезда",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ded750bddbeb-HSvrSZijpbSHOLAN.jpg",
    description: "Звезда × 1, ромб × 5",
  },
  {
    id: "apple",
    title: "Яблоко",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9b32f7b0c8f1-ReabYqEbymjBrDEY.jpg",
    description: "Яблоко × 1, лист × 2",
  },
];
export const LOSHADKA_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f8a919017d4c-WDRmWxjeWyXWNrto.webp";
export const LOSHADKA_YANDEX_URL = "https://disk.yandex.ru/i/nDfsd5ptLO1xRA";

export function getPatternsScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = viewport;
  return { SCREEN_WIDTH, SCREEN_HEIGHT };
}
