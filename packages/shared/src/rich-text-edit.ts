/** Правки текста пересчитывают диапазоны форматирования и выделение в редакторе. */
type Range = [number, number];

/** Shift formatting ranges after a single contiguous text edit. */
export function adjustRangesOnTextChange(
  oldText: string,
  newText: string,
  ranges: Range[],
): Range[] {
  if (oldText === newText) return ranges;

  let start = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (start < minLen && oldText[start] === newText[start]) start++;

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const removed = oldEnd - start;
  const inserted = newEnd - start;
  const delta = inserted - removed;

  return ranges
    .map(([s, e]) => {
      if (e <= start) return [s, e] as Range;
      if (s >= oldEnd) return [s + delta, e + delta] as Range;
      if (s >= start && e <= oldEnd) return null;
      // Partial overlap with edited text — drop range instead of leaving half-formatted words.
      return null;
    })
    .filter((r): r is Range => r !== null && r[1] > r[0] && r[0] >= 0 && r[1] <= newText.length);
}

/** Ограничиваем форматирование фактическими границами текста. */
export function clampRanges(value: string, ranges: Range[]): Range[] {
  const len = value.length;
  return mergeRanges(
    ranges
      .map(([s, e]) => [Math.max(0, s), Math.min(len, e)] as Range)
      .filter(([s, e]) => e > s),
  );
}

/** Объединяем совместимые диапазоны, не меняя смысл форматирования. */
export function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], cur[1]);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/** Меняем формат выбранного диапазона редактора. */
export function toggleRangeFormat(ranges: Range[], start: number, end: number): Range[] {
  const covered = ranges.some((r) => r[0] <= start && r[1] >= end);
  if (covered) {
    return mergeRanges(splitRange(ranges, start, end));
  }
  return mergeRanges([...ranges, [start, end]]);
}

function splitRange(ranges: Range[], start: number, end: number): Range[] {
  const next: Range[] = [];
  for (const [s, e] of ranges) {
    if (e <= start || s >= end) {
      next.push([s, e]);
      continue;
    }
    if (s < start) next.push([s, start]);
    if (e > end) next.push([end, e]);
  }
  return next;
}

/** Ограничиваем превью выделения без изменения самого текста. */
export function truncateSelectionPreview(text: string, maxLen = 72): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}
