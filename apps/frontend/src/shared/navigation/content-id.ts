/** Числовой адрес материала принимаем только в канонической форме безопасного положительного целого. */
export function parseContentId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
