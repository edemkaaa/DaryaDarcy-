"use client";
/** Текст делим на обычные и emoji-фрагменты для совместимого отображения шрифтами, не интерпретируя его как разметку. Emoji выводятся системным шрифтом, поскольку EB Garamond не содержит этих глифов. */
const EMOJI_SEGMENT_RE =
  /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;
export type TextEmojiSegment = {
  value: string;
  isEmoji: boolean;
};
/** Сохраняем исходный текст и порядок символов, выделяя распознанные emoji для системного шрифта без интерпретации HTML. */
export function splitForEmojiRendering(text: string): TextEmojiSegment[] {
  if (!text) return [];
  const parts: TextEmojiSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI_SEGMENT_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ value: text.slice(last, index), isEmoji: false });
    }
    parts.push({ value: match[0], isEmoji: true });
    last = index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ value: text.slice(last), isEmoji: false });
  }
  if (parts.length === 0) {
    parts.push({ value: text, isEmoji: false });
  }
  return parts;
}
