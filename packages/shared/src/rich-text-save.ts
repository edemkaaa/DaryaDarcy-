/** Перед сохранением согласуем текст и форматирование, не теряя границы после нормализации. */
import type { RichTextBlock } from "./rich-text-types";
import { adjustRangesOnTextChange, clampRanges } from "./rich-text-edit";
import { sanitizePlainPostText, sanitizeRichTextForDisplay } from "./post-text-sanitize";
import { rangesToRichText, richTextToRanges } from "./rich-text-ranges";

function plainTextFromBlocks(blocks: RichTextBlock[]): string {
  return blocks
    .map((block) => (block.children || []).map((child) => child.text || "").join(""))
    .join("\n");
}

function adjustLinkRanges(
  oldText: string,
  newText: string,
  links: { start: number; end: number; url: string }[],
) {
  const adjusted = links
    .map((link) => {
      const shifted = adjustRangesOnTextChange(oldText, newText, [[link.start, link.end]]);
      if (!shifted.length) return null;
      const [start, end] = shifted[0];
      return { start, end, url: link.url };
    })
    .filter((link): link is { start: number; end: number; url: string } => link !== null);

  if (adjusted.length >= links.length) return adjusted;

  const seen = new Set(adjusted.map((link) => `${link.start}:${link.end}:${link.url}`));
  for (const link of links) {
    const anchor = oldText.slice(link.start, link.end);
    if (!anchor) continue;
    let from = 0;
    while (from <= newText.length) {
      const start = newText.indexOf(anchor, from);
      if (start < 0) break;
      const end = start + anchor.length;
      const key = `${start}:${end}:${link.url}`;
      if (!seen.has(key)) {
        adjusted.push({ start, end, url: link.url });
        seen.add(key);
        break;
      }
      from = start + 1;
    }
  }

  return adjusted.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Согласуем границы блоков с подготовленным текстом перед сохранением. */
export function realignRichTextBlocks(
  blocks: RichTextBlock[],
  targetPlain: string,
  sourcePlain = plainTextFromBlocks(blocks),
): RichTextBlock[] | null {
  const sanitizedTarget = sanitizePlainPostText(targetPlain);
  const ranges = richTextToRanges(blocks);
  const hasFormatting =
    ranges.boldRanges.length > 0 ||
    ranges.italicRanges.length > 0 ||
    ranges.linkRanges.length > 0;
  if (!hasFormatting) return null;

  const bold = clampRanges(
    sanitizedTarget,
    adjustRangesOnTextChange(sourcePlain, sanitizedTarget, ranges.boldRanges),
  );
  const italic = clampRanges(
    sanitizedTarget,
    adjustRangesOnTextChange(sourcePlain, sanitizedTarget, ranges.italicRanges),
  );
  const links = adjustLinkRanges(sourcePlain, sanitizedTarget, ranges.linkRanges);

  return rangesToRichText(sanitizedTarget, bold, italic, links) ?? null;
}

/** Align plain text + richText before save (client + server). */
export function preparePostRichTextForSave(
  plainText: string,
  richText: RichTextBlock[] | undefined | null,
): { text: string; richText: RichTextBlock[] | null } {
  const text = sanitizePlainPostText(plainText);
  const blocks = sanitizeRichTextForDisplay(richText);
  if (!blocks?.length) return { text, richText: null };

  const fromRich = plainTextFromBlocks(blocks);
  if (sanitizePlainPostText(fromRich) === text) {
    return { text, richText: blocks };
  }

  const realigned = realignRichTextBlocks(blocks, text, fromRich);
  if (realigned && sanitizePlainPostText(plainTextFromBlocks(realigned)) === text) {
    return { text, richText: realigned };
  }

  return { text, richText: realigned ?? blocks };
}
