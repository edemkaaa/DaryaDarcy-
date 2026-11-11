/** Ресурсы и подписи ленты отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { FEED_TAGS } from "@/domain/post/post-tags";
export type TagSlug = string;
export interface Tag {
  slug: TagSlug;
  label: string;
}
export interface FeedPost {
  id: number;
  publicId?: string;
  text: string;
  photos: string[];
  tags: string[];
  date: string;
  likeCount: number;
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
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  target?: "feed" | "club" | "both";
  articleId?: number | null;
}

export const GRID_GAP = 1;
export const GRID_COLUMNS = 3;

export const MAX_TEXT_LINES = 3;
export const CREAM_BG = "#FDF8F0";
export const BROWN_DARK = "#4A3728";
export const BROWN_LIGHT = "#7A6B5E";
export const GREEN_ACCENT = "#8B7355";
export const DEFAULT_TAGS: Tag[] = [
  { slug: "all", label: "Все" },
  ...FEED_TAGS,
];
export const FEED_BANNER_URI =
  "/assets/responsive/banner-shelf-v2.w1024.b898ab6e8d2babca.webp";

/** Рассчитываем три равных слота сетки с единым межколоночным зазором и пропорцией фото 4:5. */
export function getFeedScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const GRID_ITEM_SIZE =
    (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const GRID_ITEM_HEIGHT = GRID_ITEM_SIZE * (5 / 4);
  return { SCREEN_WIDTH, GRID_ITEM_SIZE, GRID_ITEM_HEIGHT };
}
