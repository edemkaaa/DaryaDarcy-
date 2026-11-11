/** Ресурсы и подписи витрины Библиотеки отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";
import type { LibraryMaterialKey } from "./library-files-api";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";
export const DEFAULT_COVER_ASPECT = 0.75;
export const BANNER_URL =
  "/assets/responsive/549a6bdf3cb0-aeHHNBoBXpIdgjhp.w1200.07e7096446573650.webp";
export const GUIDE_BANNER_URL =
  "/assets/responsive/47ae04f69998-VjKNaGyYogjUkMPQ.w1200.f931112dad472e7c.webp";
export const STILIZACII_COVER_URL =
  "/assets/responsive/3b8642166933-rdRVzYWvuGEmSUdF.w1081.6380b324c6741251.webp";
export const STILIZACII_YANDEX_URL = "https://disk.yandex.ru/i/Y-XvbPF-NwOiLg";
export const RECIPES_COVER_URL =
  "/assets/responsive/877a6c2a49ef-JZjLEpuxmhqHszUD.w1200.44a1ac31d1637bd8.webp";
export const PETERBURG_COVER_URL =
  "/assets/responsive/925076516046-CkdCchNXtpJkPNVd.w1200.c85757962e32576f.webp";
export const PATTERNS_COVER_URL =
  "/assets/responsive/4327bffa91b1-TRkGduziKBAAVhso.w1200.f8dbe5d9ca763eb2.webp";
export const LOSHADKA_COVER_URL =
  "/assets/responsive/loshadka-cover.w1176.272be882ac7b774e.webp";
export const LOSHADKA_PDF_URL = "https://disk.yandex.ru/i/nDfsd5ptLO1xRA";
export const ABOUT_ME_COVER_URL =
  "/assets/responsive/1fbca647058b-LvxZFiaBWuJSsIgj.full.1f4bca1ed4720a16.webp";
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const OLIVE_BG = "#e4e0cd";
type MaterialCard = {
  id: string;
  title: string;
  coverUrl: string;
  coverAspectRatio: number; // width/height
};
export type MaterialItem = MaterialCard &
  (
    | { action: "navigate"; isClubOnly: boolean; route: string }
    | { action: "browser"; isClubOnly: false; pdfUrl: string }
    | {
        action: "private-file";
        isClubOnly: true;
        material: LibraryMaterialKey;
      }
  );
export const MATERIALS: MaterialItem[] = [
  {
    id: "aesthetics-guide",
    title: "Гид по эстетикам",
    coverUrl: GUIDE_BANNER_URL,
    coverAspectRatio: 1200 / 840,
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
    coverAspectRatio: 1081 / 1920,
    isClubOnly: false,
    action: "browser",
    pdfUrl: STILIZACII_YANDEX_URL,
  },
  {
    id: "recipes",
    title: "Сборник рецептов",
    coverUrl: RECIPES_COVER_URL,
    coverAspectRatio: 1200 / 801,
    isClubOnly: true,
    action: "private-file",
    material: "recipes",
  },
  {
    id: "peterburg",
    title: "Гид по Петербургу",
    coverUrl: PETERBURG_COVER_URL,
    coverAspectRatio: 1200 / 2133,
    isClubOnly: true,
    action: "private-file",
    material: "peterburg",
  },
  {
    id: "loshadka",
    title: "Выкройка лошадка-качалка",
    coverUrl: LOSHADKA_COVER_URL,
    coverAspectRatio: 1176 / 1500,
    isClubOnly: false,
    action: "browser",
    pdfUrl: LOSHADKA_PDF_URL,
  },
  {
    id: "patterns",
    title: "Зимние выкройки'26",
    coverUrl: PATTERNS_COVER_URL,
    coverAspectRatio: 1200 / 683,
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
