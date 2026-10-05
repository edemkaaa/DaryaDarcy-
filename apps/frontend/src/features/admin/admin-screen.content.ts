import { ALL_POST_TAGS } from "@/domain/post/post-tags";
export const CREAM_BG = "#FDF8F0";
export const BROWN_DARK = "#4A3728";
export const BROWN_LIGHT = "#7A6B5E";
export const GREEN_ACCENT = "#8B7355";
export const ALL_TAGS = ALL_POST_TAGS;
export interface PostFormData {
  text: string;
  photos: string[];
  videos: string[];
  tags: string[];
  published: boolean;
  status: "published" | "scheduled" | "draft";
  scheduledAt: Date | null;
  publishedAt: Date;
  sortOrder: number;
  target: "feed" | "club" | "both";
}
export const EMPTY_FORM: PostFormData = {
  text: "",
  photos: [],
  videos: [],
  tags: [],
  published: true,
  status: "published",
  scheduledAt: null,
  publishedAt: new Date(),
  sortOrder: 0,
  target: "feed",
};
