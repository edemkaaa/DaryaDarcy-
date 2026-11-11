/** Ресурсы и подписи редактора статей отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import { MaterialIcons } from "@/shared/ui/icons";
import { type ArticleBlock } from "@/domain/content/article-blocks";
export const BROWN = "#4A3728";
export const BROWN_LIGHT = "#7A6B5E";
export const CREAM = "#FDF8F0";
export const ACCENT = "#8B7355";
// Панель разрешает только поддерживаемые серверным контрактом блоки; PDF прикрепляется ссылочным блоком, не отдельным типом.
export const ADD_BLOCKS: {
  type: ArticleBlock["type"];
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { type: "text", label: "Текст", icon: "notes" },
  { type: "heading", label: "Заголовок", icon: "title" },
  { type: "photo", label: "Фото", icon: "photo" },
  { type: "png", label: "PNG", icon: "image" },
  { type: "carousel", label: "Карусель", icon: "view-carousel" },
  { type: "link", label: "Ссылка", icon: "link" },
];
// Все серверные типы имеют русскую подпись независимо от их технического значения в payload.
export const BLOCK_LABELS: Record<ArticleBlock["type"], string> = {
  heading: "Заголовок",
  text: "Текст",
  photo: "Фото",
  png: "PNG без фона",
  link: "Ссылка",
  carousel: "Карусель",
};
