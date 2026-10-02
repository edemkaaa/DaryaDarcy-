import type { RichTextBlock } from "./rich-text-types";

export function richTextToRanges(richText: RichTextBlock[] | null | undefined) {
  const boldRanges: [number, number][] = [];
  const italicRanges: [number, number][] = [];
  const linkRanges: { start: number; end: number; url: string }[] = [];
  if (!richText?.length) {
    return { boldRanges, italicRanges, linkRanges };
  }

  let offset = 0;
  for (let blockIndex = 0; blockIndex < richText.length; blockIndex++) {
    if (blockIndex > 0) offset += 1;
    for (const child of richText[blockIndex].children) {
      const start = offset;
      const end = offset + child.text.length;
      if (child.bold && end > start) boldRanges.push([start, end]);
      if (child.italic && end > start) italicRanges.push([start, end]);
      if (child.link && end > start) linkRanges.push({ start, end, url: child.link });
      offset = end;
    }
  }

  return { boldRanges, italicRanges, linkRanges };
}

export function rangesToRichText(
  rawText: string,
  boldRanges: [number, number][],
  italicRanges: [number, number][],
  linkRanges: { start: number; end: number; url: string }[],
): RichTextBlock[] | undefined {
  if (boldRanges.length === 0 && italicRanges.length === 0 && linkRanges.length === 0) {
    return undefined;
  }
  const paragraphs = rawText.split("\n");
  let offset = 0;
  const blocks: RichTextBlock[] = [];

  for (const para of paragraphs) {
    const paraStart = offset;
    const paraEnd = offset + para.length;
    const breakPoints = new Set<number>();
    breakPoints.add(paraStart);
    breakPoints.add(paraEnd);
    for (const [s, e] of boldRanges) {
      if (s >= paraStart && s <= paraEnd) breakPoints.add(s);
      if (e >= paraStart && e <= paraEnd) breakPoints.add(e);
    }
    for (const [s, e] of italicRanges) {
      if (s >= paraStart && s <= paraEnd) breakPoints.add(s);
      if (e >= paraStart && e <= paraEnd) breakPoints.add(e);
    }
    for (const lr of linkRanges) {
      if (lr.start >= paraStart && lr.start <= paraEnd) breakPoints.add(lr.start);
      if (lr.end >= paraStart && lr.end <= paraEnd) breakPoints.add(lr.end);
    }
    const sorted = Array.from(breakPoints).sort((a, b) => a - b);
    const children: RichTextBlock["children"] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const segStart = sorted[i];
      const segEnd = sorted[i + 1];
      const segText = rawText.slice(segStart, segEnd);
      if (segText.length === 0) continue;
      const bold = boldRanges.some((r) => r[0] <= segStart && r[1] >= segEnd) || undefined;
      const italic = italicRanges.some((r) => r[0] <= segStart && r[1] >= segEnd) || undefined;
      const linkMatch = linkRanges.find((lr) => lr.start <= segStart && lr.end >= segEnd);
      children.push({ text: segText, bold, italic, link: linkMatch?.url });
    }
    if (children.length === 0) {
      children.push({ text: "" });
    }
    blocks.push({ type: "paragraph", children });
    offset = paraEnd + 1;
  }
  return blocks;
}
