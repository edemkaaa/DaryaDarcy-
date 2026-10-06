import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
export const SEASONAL_TARTANS = {
  autumn:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ff49f6ba1a27-NdnEHWCbQbNuKmyB.JPG",
  winter:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ea0b60bea0fe-EhNRvSBlhxWjRXfT.JPG",
};
export const SEASONAL_BANNERS = {
  autumn:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e8e5386d449f-xGuqHGnxPOYPLwJz.webp",
  winter:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ea0b60bea0fe-EhNRvSBlhxWjRXfT.JPG",
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
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8cd6e38feb2b-GEblEVfYOlTMcdZL.webp",
  },
  {
    id: "community",
    label: "Комьюнити",
    stickerUri:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbdc4edd1f6-WglvBAnfwHsodSFE.webp",
  },
  {
    id: "exclusive",
    label: "Эксклюзив",
    stickerUri:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4754542d454e-ioZaSTACsHELFmfu.PNG",
  },
  {
    id: "life",
    label: "Лайф",
    stickerUri:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/011254ea51fb-iXlFvAzqcTIXBklq.png",
  },
];
export const STICKER_LIKE =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/049e3831441b-iirWKYJcvPUnEdXs.webp";
export const STICKER_SAVE =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8b44a02c41d1-avIlcuIRwQPHiWEZ.webp";
export const MAILBOX_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ce515dd1f602-yLEBPmBjoZXimIfm.webp";
// First-stage release shows a placeholder; reopening also requires the API capability.
export const PEN_PALS_ENABLED = false;
export interface ClubPost {
  id: string;
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
