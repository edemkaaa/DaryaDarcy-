"use client";
/** Списки названий и источников приводим к читабельному виду без изменения самих материалов. */
const DESCRIPTION_SEPARATORS = [" — ", " – ", " - "] as const;
/** Срезаем описание по последнему согласованному разделителю тире, не оставляя пустую подпись вместо исходного текста. */
export function stripInspirationDescription(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return trimmed;
  let lastIndex = -1;
  for (const separator of DESCRIPTION_SEPARATORS) {
    const index = trimmed.lastIndexOf(separator);
    if (index > lastIndex) {
      lastIndex = index;
    }
  }
  if (lastIndex <= 0) return trimmed;
  const title = trimmed.slice(0, lastIndex).trim();
  return title || trimmed;
}
/** Собираем краткие названия источников в одну строку после одинаковой очистки описаний. */
export function formatInspirationList(items: string[]): string {
  return items.map(stripInspirationDescription).join(", ");
}
