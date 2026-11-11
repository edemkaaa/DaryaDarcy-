// Архив Expo. Формат локальной доски: координаты в рабочей области, порядок слоёв и метка прозрачной наклейки.
export type MoodboardSeason = "summer" | "autumn" | "winter" | "spring";

export type MoodboardItem = {
  id: string;
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** PNG sticker without background */
  cutout?: boolean;
};

export type MoodboardDoc = {
  id: string;
  season: MoodboardSeason;
  title: string;
  items: MoodboardItem[];
  updatedAt: string;
};

export type MoodboardCatalogImage = {
  id: string;
  uri: string;
  aspect: number;
  /** PNG / sticker on transparent background */
  cutout?: boolean;
};
