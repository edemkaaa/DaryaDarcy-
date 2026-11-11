// Архив Expo. Упорядочивает границы и отклоняет пустое либо выходящее за текст выделение.
import { Platform } from "react-native";

export const RICH_TEXT_INPUT_ID = "rich-text-field-input";

type Selection = { start: number; end: number };

export function normalizeSelection(value: string, sel: Selection): Selection | null {
  // Упорядочивает границы и отклоняет пустое либо выходящее за текст выделение.

  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  if (start === end || end > value.length || start < 0) return null;
  return { start, end };
}

/** Trim spaces/tabs at edges; keep newlines so multi-line selections stay intact. */
export function normalizeFormatRange(value: string, sel: Selection): Selection | null {
  // Убирает только краевые пробелы/табуляцию, сохраняя переносы многострочного выделения.

  const base = normalizeSelection(value, sel);
  if (!base) return null;
  let { start, end } = base;
  while (start < end && /[ \t]/.test(value[start])) start++;
  while (end > start && /[ \t]/.test(value[end - 1])) end--;
  if (start >= end) return null;
  return { start, end };
}

export type SelectionAnchor = Selection & { text: string };

export function anchorSelection(value: string, sel: Selection): SelectionAnchor | null {
  // Сохраняет нормализованные индексы вместе с точным текстом якоря.

  const normalized = normalizeFormatRange(value, sel);
  if (!normalized) return null;
  return {
    ...normalized,
    text: value.slice(normalized.start, normalized.end),
  };
}

/** Match selection by stored text if indices drifted (emoji, edits, mobile selection quirks). */
export function resolveFormatRange(value: string, sel: Selection, snapshot?: string | null): Selection | null {
  // Предпочитает живое выделение и ищет старый текст только в ограниченной окрестности при допустимом fallback.

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

export function findRichTextInput(): HTMLTextAreaElement | null {
  // Находит web textarea по стабильному id/name без доступа к DOM на native.

  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  return (
    (document.getElementById(RICH_TEXT_INPUT_ID) as HTMLTextAreaElement | null) ??
    (document.querySelector(`textarea#${RICH_TEXT_INPUT_ID}`) as HTMLTextAreaElement | null) ??
    (document.querySelector(`textarea[name="${RICH_TEXT_INPUT_ID}"]`) as HTMLTextAreaElement | null)
  );
}

export function readLiveSelection(value: string, fallback: Selection): Selection | null {
  // На web берёт реальные индексы textarea, иначе нормализует сохранённый RN диапазон.

  if (Platform.OS === "web") {
    const node = findRichTextInput();
    if (node) {
      return normalizeFormatRange(value, { start: node.selectionStart, end: node.selectionEnd });
    }
  }
  return normalizeFormatRange(value, fallback);
}

export function restoreDomSelection(start: number, end: number) {
  // Возвращает фокус и выделение web-полю после действий панели форматирования.

  if (Platform.OS !== "web") return;
  const node = findRichTextInput();
  if (!node) return;
  node.focus();
  node.setSelectionRange(start, end);
}
