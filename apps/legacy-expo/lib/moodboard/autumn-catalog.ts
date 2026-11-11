// Архив Expo. Возвращает первые 51 готовых изображения только осеннего каталога, остальные сезоны пусты.
import type { MoodboardCatalogImage } from "@/lib/moodboard/types";
import generated from "@/lib/moodboard/autumn-catalog.generated.json";

/** First 51 images — unique set from the «осень» folder on Yandex Disk. */
export const AUTUMN_CATALOG: MoodboardCatalogImage[] = (
  generated as MoodboardCatalogImage[]
).slice(0, 51);

export function catalogForSeason(season: string): MoodboardCatalogImage[] {
  // Возвращает первые 51 готовых изображения только осеннего каталога, остальные сезоны пусты.

  if (season === "autumn") return AUTUMN_CATALOG;
  return [];
}
