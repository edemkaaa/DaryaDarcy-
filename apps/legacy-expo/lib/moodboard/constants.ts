// Архив Expo. Палитра, лимит бесплатных локальных досок и доступность сезонных каталогов.
import type { MoodboardSeason } from "@/lib/moodboard/types";

export const MOODBOARD_FREE_LIMIT = 3;

export const MOODBOARD_BROWN = "#5C4033";
export const MOODBOARD_BROWN_DARK = "#3D2B1F";
export const MOODBOARD_CREAM = "#FDF8F0";
export const MOODBOARD_RIBBON = "#6B4E3D";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

export { BOARD_FRAME_ASPECT, BOARD_CANVAS_INSETS } from "@/lib/moodboard/board-geometry";

export const SEASON_META: Record<
  MoodboardSeason,
  { label: string; labelShort: string; enabled: boolean }
> = {
  summer: { label: "Лето", labelShort: "лето", enabled: false },
  autumn: { label: "Осень", labelShort: "осень", enabled: true },
  winter: { label: "Зима", labelShort: "зима", enabled: false },
  spring: { label: "Весна", labelShort: "весна", enabled: false },
};
