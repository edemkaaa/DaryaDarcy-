/** Изменение выделения передаётся форматирующим инструментам в координатах текста, а не DOM-разметки. */
export type TextEditHint = { start: number; end: number; inputType: string };
type Range = [number, number];

/** Prefer the actual native edit over a text diff, which is ambiguous for repeats. */
function resolveChange(
  oldText: string,
  newText: string,
  hint?: TextEditHint | null,
) {
  // Предпочитает native beforeinput, чтобы повторяющиеся буквы не смещали форматирование; только затем ищет общий префикс и суффикс.

  if (hint) {
    let { start, end } = hint;
    const removed = oldText.length - newText.length;
    if (start === end && removed > 0) {
      if (hint.inputType.endsWith("Backward")) start -= removed;
      else if (hint.inputType.endsWith("Forward")) end += removed;
    }
    const inserted = newText.length - oldText.length + end - start;
    if (
      start >= 0 &&
      end >= start &&
      end <= oldText.length &&
      inserted >= 0 &&
      oldText.slice(0, start) === newText.slice(0, start) &&
      oldText.slice(end) === newText.slice(start + inserted)
    ) {
      return { start, end, inserted };
    }
  }
  let start = 0;
  while (
    start < Math.min(oldText.length, newText.length) &&
    oldText[start] === newText[start]
  )
    start++;
  let end = oldText.length;
  let newEnd = newText.length;
  while (
    end > start &&
    newEnd > start &&
    oldText[end - 1] === newText[newEnd - 1]
  ) {
    end--;
    newEnd--;
  }
  return { start, end, inserted: newEnd - start };
}

export function adjustEditorRanges(
  oldText: string,
  newText: string,
  ranges: Range[],
  hint?: TextEditHint | null,
): Range[] {
  // Применяет один вычисленный текстовый сдвиг к диапазонам форматирования.

  return createEditorRangeAdjuster(oldText, newText, hint)(ranges);
}

/** Find the edit once for all formatting ranges, and skip unformatted text. */
export function createEditorRangeAdjuster(
  oldText: string,
  newText: string,
  hint?: TextEditHint | null,
) {
  // Лениво вычисляет изменение один раз для всех наборов диапазонов; удалённый исходный текст теряет своё форматирование.

  let change: ReturnType<typeof resolveChange> | undefined;
  return (ranges: Range[]): Range[] => {
    if (!ranges.length || oldText === newText) return ranges;
    const { start, end, inserted } = (change ??= resolveChange(
      oldText,
      newText,
      hint,
    ));
    const delta = inserted - (end - start);
    const adjusted = ranges
      .map((range): Range | null => {
        const [from, to] = range;
        if (to <= start) return range;
        if (from >= end) return delta ? [from + delta, to + delta] : range;
        // No remaining original text means its formatting must disappear as well.
        if (from >= start && to <= end) return null;
        return [
          from < start ? from : start + inserted,
          to > end ? to + delta : start,
        ];
      })
      .filter(
        (range): range is Range =>
          range !== null &&
          range[0] >= 0 &&
          range[1] > range[0] &&
          range[1] <= newText.length,
      );
    return adjusted.length === ranges.length &&
      adjusted.every((range, i) => range === ranges[i])
      ? ranges
      : adjusted;
  };
}
