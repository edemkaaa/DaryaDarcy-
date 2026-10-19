import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";
export const SEASONAL_TARTANS = {
  autumn:
    "/assets/responsive/ff49f6ba1a27-NdnEHWCbQbNuKmyB.w1199.6b2a60f6e3359cff.webp",
  winter:
    "/assets/responsive/ea0b60bea0fe-EhNRvSBlhxWjRXfT.w1200.4cceecb893c4381e.webp",
};
export const SEASONAL_BANNERS = {
  autumn:
    "/assets/responsive/e8e5386d449f-xGuqHGnxPOYPLwJz.w900.c32035de391abc36.webp",
  winter:
    "/assets/responsive/ea0b60bea0fe-EhNRvSBlhxWjRXfT.w1200.4cceecb893c4381e.webp",
};
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const CREAM = "#FDF8F0";
export const OLIVE = "#6B7B5E";
export const SAGE = "#8FA87A";

export type ClubTab = "podborki" | "community" | "exclusive" | "life";
export interface ClubTabItem {
  id: ClubTab;
  label: string;
  stickerUri: string;
}
export const CLUB_TABS: ClubTabItem[] = [
  {
    id: "podborki",
    label: "Подборки",
    stickerUri:
      "/assets/responsive/8cd6e38feb2b-GEblEVfYOlTMcdZL.w640.eeeac2bcbdaf78b8.webp",
  },
  {
    id: "community",
    label: "Комьюнити",
    stickerUri:
      "/assets/responsive/1fbdc4edd1f6-WglvBAnfwHsodSFE.w864.266828b41b91d03d.webp",
  },
  {
    id: "exclusive",
    label: "Эксклюзив",
    stickerUri:
      "/assets/responsive/4754542d454e-ioZaSTACsHELFmfu.w599.9390ce6b2a0a9ec6.webp",
  },
  {
    id: "life",
    label: "Лайф",
    stickerUri:
      "/assets/responsive/011254ea51fb-iXlFvAzqcTIXBklq.w299.6730d3cb4a533066.webp",
  },
];
export const STICKER_LIKE =
  "/assets/responsive/049e3831441b-iirWKYJcvPUnEdXs.w900.edd13b8369b9091a.webp";
export const STICKER_SAVE =
  "/assets/responsive/8b44a02c41d1-avIlcuIRwQPHiWEZ.w564.4d4e95a1307037cb.webp";
export const MAILBOX_URI =
  "/assets/responsive/ce515dd1f602-yLEBPmBjoZXimIfm.w900.3839453db773a65e.webp";
// First-stage release shows a placeholder; reopening also requires the API capability.
export const PEN_PALS_ENABLED = false;
export interface ClubPost {
  id: string;
  target: "feed" | "club" | "both";
  title: string;
  preview: string;
  rawText?: string;
  date: string;
  createdAt?: string | Date | null;
  publishedAt?: string | Date | null;
  tags: string[];
  photos?: string[];
  media?: {
    id: number;
    type: "video" | "audio" | "document";
    url: string;
    filename?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
    duration?: number | null;
    posterUrl?: string | null;
  }[];
  richText?:
    | {
        type: "paragraph" | "heading";
        children: {
          text: string;
          bold?: boolean;
          italic?: boolean;
          link?: string;
        }[];
      }[]
    | null;
  articleId?: number | null;
  commentCount?: number;
}
export const PROFILE_COMPLETED_KEY = "@darcy_club_profile_completed";

export function getClubSubscribedContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  return { SCREEN_WIDTH };
}
