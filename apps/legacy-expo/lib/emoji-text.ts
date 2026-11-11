// Архив Expo. Выделяет emoji-сегменты для системного шрифта, сохраняя порядок и обычный текст между ними.
/** Split plain text so emoji render with system fonts (EBGaramond has no emoji glyphs). */
const EMOJI_SEGMENT_RE =
  /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;

export type TextEmojiSegment = { value: string; isEmoji: boolean };

export function splitForEmojiRendering(text: string): TextEmojiSegment[] {
  // Выделяет emoji-сегменты для системного шрифта, сохраняя порядок и обычный текст между ними.

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
