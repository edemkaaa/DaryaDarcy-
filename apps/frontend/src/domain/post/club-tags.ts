/** Клубные рубрики и правила обсуждений берём из общего пакета; локально добавляем подписи для отображения. */
export * from "@shared/club-tags";
import {
  clubTagLabel as sharedClubTagLabel,
  normalizeClubTag,
} from "@shared/club-tags";
import { postTagLabel } from "./post-tags";

/** Сначала используем общую подпись клубной рубрики, затем словарь тем постов; неизвестный тег сохраняем как есть. */
export function clubTagLabel(tag: string): string {
  const label = sharedClubTagLabel(tag);
  if (label !== tag) return label;
  const slug = normalizeClubTag(tag);
  const postLabel = postTagLabel(slug);
  return postLabel !== slug ? postLabel.toLowerCase() : tag;
}
