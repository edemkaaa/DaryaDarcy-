import type { ViewportSize } from "@/shared/browser/viewport";

export const CROSSFADE_DURATION = 2000;
export const SLIDE_INTERVAL = 5000;
export const SECTION_CONTENT_COUNTS: Record<string, number> = {
  feed: 8,
  club: 5,
  interactive: 3,
  library: 10,
  shop: 3,
};
export const SECTION_LAST_UPDATED: Record<string, string> = {
  feed: "2026-04-20", // Most recent feed post: "Организация кухонной кладовки" - 20 апреля
  club: "2026-04-20", // Most recent club post: "Письмо апреля" - 20 апреля
  interactive: "2026-04-15", // Interactive items are upcoming (status: "Скоро")
  library: "2026-04-10", // Library items have no explicit dates, estimated
  shop: "2026-04-05",
};
export const SECTION_BANNERS = [
  {
    id: "feed",
    title: "Лента",
    subtitle: "Блог о загородной жизни, винтажном стиле и вдохновении",
    route: "/feed" as const,
    icon: "article" as const,
    image:
      "/assets/responsive/cc53a49e1416-qxGDcExHmMNZuoWc.w640.184c30d80055f4f0.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.feed,
    newCount: SECTION_CONTENT_COUNTS.feed,
  },
  {
    id: "club",
    title: "Клуб Darcy",
    subtitle: "Камерное сообщество с эксклюзивными материалами",
    route: "/club" as const,
    icon: "star" as const,
    image:
      "/assets/responsive/597ab82580a0-GDVbsOSXBYgogKWH.w640.ba28fbfe01bdb50b.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.club,
    newCount: SECTION_CONTENT_COUNTS.club,
  },
  {
    id: "interactive",
    title: "Интерактив",
    subtitle: "Тесты, игры, творческие задания",
    route: "/interactive" as const,
    icon: "auto-awesome" as const,
    image:
      "/assets/responsive/6ac128a122fc-aEjJLmnJbZuksHiz.w640.2f118048a4e6da6d.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.interactive,
    newCount: SECTION_CONTENT_COUNTS.interactive,
  },
  {
    id: "library",
    title: "Библиотека",
    subtitle: "Бесплатные материалы: выкройки, сборники, плейлисты",
    route: "/library" as const,
    icon: "menu-book" as const,
    image:
      "/assets/responsive/7e8f673737d1-bGwFUQjrxWpTxAMM.w640.4f639bc18607fcbd.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.library,
    newCount: SECTION_CONTENT_COUNTS.library,
  },
  {
    id: "shop",
    title: "Магазин",
    subtitle: "Печатные книги, электронные пособия и другие продукты",
    route: "/shop" as const,
    icon: "shopping-bag" as const,
    image:
      "/assets/responsive/8283ecb861ab-BSgzKdVEmubRcHjZ.w640.e2cbbb1eec9a9ba6.jpg",
    hasNew: true,
    lastUpdated: SECTION_LAST_UPDATED.shop,
    newCount: SECTION_CONTENT_COUNTS.shop,
  },
];
export const CREAM = "#F5EDE0";
export const CREAM_BG = "#FDF8F0";
export const BROWN_DARK = "#4A3728";
export const BROWN_MID = "#6B5B4E";
export const BROWN_LIGHT = "#8B7355";
export const ACCENT_GREEN = "#8B7355";
export const HERO_ASPECT = 1152 / 2048;

export function getHomeScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const HERO_HEIGHT = SCREEN_WIDTH * 0.6;
  return { SCREEN_WIDTH, HERO_HEIGHT };
}
