import { describe, expect, it } from "vitest";
import { rangesToRichText, richTextToRanges } from "../packages/shared/src/rich-text-ranges";

describe("rich-text-ranges", () => {
  it("roundtrips multiple bold ranges in one paragraph", () => {
    const text = "Первая фраза. Вторая фраза. Третья.";
    const boldRanges: [number, number][] = [
      [0, 13],
      [15, 28],
    ];
    const blocks = rangesToRichText(text, boldRanges, [], []);
    expect(blocks).toBeDefined();
    const restored = richTextToRanges(blocks!);
    expect(restored.boldRanges).toEqual(boldRanges);
  });

  it("roundtrips bold + link in different phrases", () => {
    const text = "Жирный текст. Ссылка здесь.";
    const boldRanges: [number, number][] = [[0, 12]];
    const linkRanges = [{ start: 14, end: 26, url: "https://example.com" }];
    const blocks = rangesToRichText(text, boldRanges, [], linkRanges);
    const restored = richTextToRanges(blocks!);
    expect(restored.boldRanges).toEqual(boldRanges);
    expect(restored.linkRanges).toEqual(linkRanges);
  });

  it("roundtrips multiple links in one paragraph", () => {
    const text = "Первая ссылка и вторая ссылка в одном посте.";
    const linkRanges = [
      { start: 0, end: 13, url: "https://one.example" },
      { start: 16, end: 29, url: "https://two.example" },
    ];
    const blocks = rangesToRichText(text, [], [], linkRanges);
    const restored = richTextToRanges(blocks!);
    expect(restored.linkRanges).toEqual(linkRanges);
  });
});
