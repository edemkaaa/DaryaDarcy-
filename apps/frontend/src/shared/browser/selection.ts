"use client";
/** Выделение текста сохраняем в координатах поля, чтобы панели форматирования не теряли выбранный диапазон. */
export const RICH_TEXT_INPUT_ID = "rich-text-field-input";
type Selection = {
  start: number;
  end: number;
};
/** Упорядочиваем координаты и отклоняем пустой или выходящий за текст диапазон до применения форматирования. */
export function normalizeSelection(
  value: string,
  sel: Selection,
): Selection | null {
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  if (start === end || end > value.length || start < 0) return null;
  return { start, end };
}
/** Убираем пробелы и табы только по краям выделения, сохраняя переносы строк внутри многострочного форматирования. */
export function normalizeFormatRange(
  value: string,
  sel: Selection,
): Selection | null {
  const base = normalizeSelection(value, sel);
  if (!base) return null;
  let { start, end } = base;
  while (start < end && /[ \t]/.test(value[start])) start++;
  while (end > start && /[ \t]/.test(value[end - 1])) end--;
  if (start >= end) return null;
  return { start, end };
}
export type SelectionAnchor = Selection & {
  text: string;
};
/** Сохраняем нормализованный диапазон вместе с его текстом, чтобы последующая команда могла сверить актуальное выделение. */
export function anchorSelection(
  value: string,
  sel: Selection,
): SelectionAnchor | null {
  const normalized = normalizeFormatRange(value, sel);
  if (!normalized) return null;
  return {
    ...normalized,
    text: value.slice(normalized.start, normalized.end),
  };
}
/** Приоритет имеет живой непустой диапазон; сохранённый snapshot не должен самопроизвольно переносить форматирование на другой фрагмент. При сдвинувшихся индексах сопоставляем сохранённый текст, учитывая emoji и правки. */
export function resolveFormatRange(
  value: string,
  sel: Selection,
  snapshot?: string | null,
): Selection | null {
  const normalized = normalizeFormatRange(value, sel);
  if (!normalized) return null;
  if (!snapshot) return normalized;
  const current = value.slice(normalized.start, normalized.end);
  if (current === snapshot) return normalized;
  // Never jump to an older snapshot elsewhere when the live selection already moved.
  if (current.length > 0) return normalized;
  const searchFrom = Math.max(0, normalized.start - 160);
  const searchTo = Math.min(value.length, normalized.end + 160);
  const haystack = value.slice(searchFrom, searchTo);
  let best: Selection | null = null;
  let bestDistance = Infinity;
  let localIndex = 0;
  while ((localIndex = haystack.indexOf(snapshot, localIndex)) >= 0) {
    const start = searchFrom + localIndex;
    const end = start + snapshot.length;
    if (start === normalized.start) {
      return { start, end };
    }
    const distance = Math.abs(start - normalized.start);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { start, end };
    }
    localIndex += 1;
  }
  return best ?? normalized;
}
/** Находим совместимое поле по единому ID/name; отсутствие DOM или редактора возвращает null вместо ошибки инструмента. */
export function findRichTextInput(): HTMLTextAreaElement | null {
  if (typeof document === "undefined") return null;
  return (
    (document.getElementById(
      RICH_TEXT_INPUT_ID,
    ) as HTMLTextAreaElement | null) ??
    (document.querySelector(
      `textarea#${RICH_TEXT_INPUT_ID}`,
    ) as HTMLTextAreaElement | null) ??
    (document.querySelector(
      `textarea[name="${RICH_TEXT_INPUT_ID}"]`,
    ) as HTMLTextAreaElement | null)
  );
}
/** Берём текущие DOM-координаты, если поле существует, иначе проверяем переданный fallback той же нормализацией. */
export function readLiveSelection(
  value: string,
  fallback: Selection,
): Selection | null {
  {
    const node = findRichTextInput();
    if (node) {
      return normalizeFormatRange(value, {
        start: node.selectionStart,
        end: node.selectionEnd,
      });
    }
  }
  return normalizeFormatRange(value, fallback);
}
/** После работы панели возвращаем фокус и диапазон в существующее поле; сам текст и разметку не меняем. */
export function restoreDomSelection(start: number, end: number) {
  const node = findRichTextInput();
  if (!node) return;
  node.focus();
  node.setSelectionRange(start, end);
}
