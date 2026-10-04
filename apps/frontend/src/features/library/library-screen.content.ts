import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
export const DEFAULT_COVER_ASPECT = 0.75;
export const BANNER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/549a6bdf3cb0-aeHHNBoBXpIdgjhp.jpeg";
export const GUIDE_BANNER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg";
export const STILIZACII_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3b8642166933-rdRVzYWvuGEmSUdF.jpeg";
export const STILIZACII_YANDEX_URL = "https://disk.yandex.ru/i/Y-XvbPF-NwOiLg";
export const RECIPES_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/877a6c2a49ef-JZjLEpuxmhqHszUD.jpg";
export const RECIPES_YANDEX_URL = "https://disk.yandex.ru/i/nUoIS8gQ5VkClA";
export const PETERBURG_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/925076516046-CkdCchNXtpJkPNVd.JPG";
export const PETERBURG_YANDEX_URL = "https://disk.yandex.ru/d/BM0uzv2cWZeM0Q";
export const PATTERNS_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg";
export const LOSHADKA_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/library/loshadka-cover.jpg";
export const LOSHADKA_YANDEX_URL = "https://disk.yandex.ru/i/nDfsd5ptLO1xRA";
export const ABOUT_ME_COVER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG";
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const OLIVE_BG = "#e4e0cd";
export interface MaterialItem {
  id: string;
  title: string;
  coverUrl: string;
  coverAspectRatio: number; // width/height
  isClubOnly: boolean;
  action: "navigate" | "pdf" | "browser";
  route?: string;
  pdfUrl?: string;
}
export const MATERIALS: MaterialItem[] = [
  {
    id: "aesthetics-guide",
    title: "Гид по эстетикам",
    coverUrl: GUIDE_BANNER_URL,
    coverAspectRatio: 1.4,
    isClubOnly: true,
    action: "navigate",
    route: "/library/aesthetics-guide",
  },
  {
    id: "about-me",
    title: "Обо мне",
    coverUrl: ABOUT_ME_COVER_URL,
    coverAspectRatio: 0.75,
    isClubOnly: false,
    action: "navigate",
    route: "/library/about-me",
  },
  {
    id: "stilizacii",
    title: "Сборник стилизаций",
    coverUrl: STILIZACII_COVER_URL,
    coverAspectRatio: 0.58,
    isClubOnly: false,
    action: "browser",
    pdfUrl: STILIZACII_YANDEX_URL,
  },
  {
    id: "recipes",
    title: "Сборник рецептов",
    coverUrl: RECIPES_COVER_URL,
    coverAspectRatio: 1.5,
    isClubOnly: true,
    action: "browser",
    pdfUrl: RECIPES_YANDEX_URL,
  },
  {
    id: "peterburg",
    title: "Гид по Петербургу",
    coverUrl: PETERBURG_COVER_URL,
    coverAspectRatio: 0.72,
    isClubOnly: true,
    action: "browser",
    pdfUrl: PETERBURG_YANDEX_URL,
  },
  {
    id: "loshadka",
    title: "Выкройка лошадка-качалка",
    coverUrl: LOSHADKA_COVER_URL,
    coverAspectRatio: 1176 / 1500,
    isClubOnly: false,
    action: "browser",
    pdfUrl: LOSHADKA_YANDEX_URL,
  },
  {
    id: "patterns",
    title: "Зимние выкройки'26",
    coverUrl: PATTERNS_COVER_URL,
    coverAspectRatio: 1.5,
    isClubOnly: true,
    action: "navigate",
    route: "/library/patterns",
  },
];

export const GRID_GAP = 12;
export const HORIZONTAL_PADDING = 16;

export const CARD_META_HEIGHT = 78;

export function getLibraryScreenContent(viewport: ViewportSize) {
  const screenWidth = viewport.width;
  const COLUMN_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;
  return { screenWidth, COLUMN_WIDTH };
}
