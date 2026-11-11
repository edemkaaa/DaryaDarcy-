/** Раскладка рядов выбирается по числу фотографий; порядок исходных изображений сохраняется. */
/** Разбиваем последовательность индексов на заполненные ряды; особые размеры 5 и 7 сохраняют более крупный первый ряд. */
export function postPhotoRows(count: number): number[][] {
  const sizes = count === 5 ? [2, 3] : count === 7 ? [3, 4] : null;
  const columns = count <= 3 ? count : count === 4 ? 2 : count === 8 ? 4 : 3;
  const rows: number[][] = [];
  for (let offset = 0; offset < count; ) {
    const size = sizes?.[rows.length] ?? columns;
    rows.push(
      Array.from(
        { length: Math.min(size, count - offset) },
        (_, i) => offset + i,
      ),
    );
    offset += size;
  }
  return rows;
}
