import type { ImageSource } from "expo-image";
import type { MoodboardSeason } from "@/lib/moodboard/types";

/** Local PNG with alpha — без чёрного фона и без CDN-кэша. */
export const MOODBOARD_FOLDER_SOURCES: Record<MoodboardSeason, ImageSource> = {
  summer: require("@/assets/images/moodboard/folder-summer.png"),
  autumn: require("@/assets/images/moodboard/folder-autumn.png"),
  winter: require("@/assets/images/moodboard/folder-winter.png"),
  spring: require("@/assets/images/moodboard/folder-spring.png"),
};

export const MOODBOARD_BOARD_FRAME_SOURCE: ImageSource = require("@/assets/images/moodboard/board-frame-alpha.png");
