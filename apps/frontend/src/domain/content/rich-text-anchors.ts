"use client";
/** Текстовые якоря помогают найти прежнее выделение после правок; неоднозначные совпадения не следует считать точной позицией. */
type Selection = {
  start: number;
  end: number;
};
/** Считаем номер данного вхождения выделенного текста, учитывая также перекрывающиеся совпадения. */
export function selectionOccurrence(
  text: string,
  start: number,
  end: number,
): number {
  const anchor = text.slice(start, end);
  if (!anchor) return 0;
  let occurrence = 0;
  let from = 0;
  while (from < start) {
    const idx = text.indexOf(anchor, from);
    if (idx < 0 || idx >= start) break;
    occurrence += 1;
    from = idx + 1;
  }
  return occurrence;
}
/** Находим тот же номер вхождения якоря в текущем тексте; отсутствие совпадения возвращаем явно как null. */
export function rangeForOccurrence(
  text: string,
  anchor: string,
  occurrence: number,
): Selection | null {
  if (!anchor) return null;
  let from = 0;
  let seen = 0;
  while (from <= text.length) {
    const start = text.indexOf(anchor, from);
    if (start < 0) return null;
    if (seen === occurrence) {
      return { start, end: start + anchor.length };
    }
    seen += 1;
    from = start + 1;
  }
  return null;
}
/** Сравниваем полуоткрытые диапазоны: соприкасающиеся края не считаются пересечением. */
export function rangesOverlap(a: Selection, b: Selection): boolean {
  return a.start < b.end && b.start < a.end;
}
