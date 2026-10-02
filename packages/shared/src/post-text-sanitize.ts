import type { RichTextBlock } from "./rich-text-types";
import { preparePostRichTextForSave } from "./rich-text-save";

/** Remove control chars / broken glyphs that break mobile web text layout. */
export function sanitizePlainPostText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Clean inline segment without trimming internal spaces. */
function cleanInlineSegment(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\uFFFD/g, "");
}

function splitBlockOnNewlines(block: RichTextBlock): RichTextBlock[] {
  const children = block.children || [];
  const parts: RichTextBlock[] = [];
  let bucket: RichTextBlock["children"] = [];

  const flush = () => {
    if (!bucket.length) return;
    parts.push({ type: block.type, children: bucket });
    bucket = [];
  };

  for (const child of children) {
    const raw = typeof child.text === "string" ? child.text : "";
    const segments = raw.split("\n");
    segments.forEach((segment, index) => {
      const cleaned = cleanInlineSegment(segment);
      if (cleaned.length > 0) {
        bucket.push({
          text: cleaned,
          ...(child.bold ? { bold: true } : {}),
          ...(child.italic ? { italic: true } : {}),
          ...(child.link ? { link: child.link } : {}),
        });
      }
      if (index < segments.length - 1) flush();
    });
  }
  flush();
  return parts;
}

/** Normalize rich text for safe feed/club rendering on mobile Safari. */
export function sanitizeRichTextForDisplay(
  value: unknown,
): RichTextBlock[] | null {
  if (!Array.isArray(value)) return null;

  const blocks = value
    .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object")
    .flatMap((block) => {
      const type = block.type === "heading" ? "heading" : "paragraph";
      const children = (Array.isArray(block.children) ? block.children : [])
        .filter((child): child is Record<string, unknown> => Boolean(child) && typeof child === "object")
        .map((child) => ({
          text: cleanInlineSegment(typeof child.text === "string" ? child.text : ""),
          ...(child.bold ? { bold: true } : {}),
          ...(child.italic ? { italic: true } : {}),
          ...(typeof child.link === "string" && child.link ? { link: child.link } : {}),
        }))
        .filter((child) => child.text.length > 0 || child.link);
      if (!children.length) return [];
      return splitBlockOnNewlines({ type, children } as RichTextBlock);
    })
    .filter((block) => block.children.length > 0);

  return blocks.length ? blocks : null;
}

/** Normalize before saving to DB (admin + import). */
export function normalizeRichTextForStorage(
  value: unknown,
  plainText: string,
): RichTextBlock[] | null {
  return preparePostRichTextForSave(plainText, value as RichTextBlock[] | null).richText;
}
