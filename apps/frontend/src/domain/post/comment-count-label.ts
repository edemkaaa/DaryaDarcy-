"use client";
/** Склонение счётчика комментариев и предел ввода собраны вместе, чтобы одинаково отображаться в разных карточках. */
/** Russian plural for «N комментарий/комментария/комментариев». */
export function commentCountLabel(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "комментариев";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = "комментарий";
    else if (mod10 >= 2 && mod10 <= 4) word = "комментария";
  }
  return `${n} ${word}`;
}
export const COMMENT_CHAR_LIMIT = 1000;
