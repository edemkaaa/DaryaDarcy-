/** Keep attachment order and fill every row, with larger photos first. */
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
