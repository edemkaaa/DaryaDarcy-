import { describe, expect, it } from "vitest";
import { rangesToRichText } from "../lib/rich-text-ranges";
import {
  normalizeRichTextForStorage,
  sanitizePlainPostText,
  sanitizeRichTextForDisplay,
} from "../lib/post-text-sanitize";

describe("post-text-sanitize", () => {
  it("strips control characters after line breaks", () => {
    const raw = "Первый абзац\n\nВторой абзац\u000Bс символом\uFFFD";
    expect(sanitizePlainPostText(raw)).toBe("Первый абзац\n\nВторой абзацс символом");
  });

  it("splits richText blocks on embedded newlines", () => {
    const blocks = sanitizeRichTextForDisplay([
      {
        type: "paragraph",
        children: [{ text: "Строка 1\n\nСтрока 2" }],
      },
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks?.[0].children[0].text).toBe("Строка 1");
    expect(blocks?.[1].children[0].text).toBe("Строка 2");
  });

  it("stores rich text with links when plain text matches", () => {
    const text = "~ Октябрь\n• Клетчатое платье\n• Фартук";
    const linkRanges = [{ start: 12, end: 29, url: "https://example.com/dress" }];
    const blocks = rangesToRichText(text, [], [], linkRanges);
    const stored = normalizeRichTextForStorage(blocks, text);
    expect(stored).not.toBeNull();
    expect(stored?.some((block) => block.children.some((child) => child.link === "https://example.com/dress"))).toBe(
      true,
    );
  });

  it("realigns rich text when plain text only differs by trailing whitespace", () => {
    const text = "Ссылка здесь";
    const blocks = rangesToRichText(text, [], [], [{ start: 0, end: 6, url: "https://example.com" }]);
    const stored = normalizeRichTextForStorage(blocks, `${text} `);
    expect(stored).not.toBeNull();
    expect(stored?.some((block) => block.children.some((child) => child.link))).toBe(true);
  });

  it("preserves italic flags for EB Garamond rendering", () => {
    const blocks = sanitizeRichTextForDisplay([
      {
        type: "paragraph",
        children: [{ text: "Тест курсива", italic: true }],
      },
    ]);
    expect(blocks?.[0].children[0].italic).toBe(true);
    expect(blocks?.[0].children[0].text).toBe("Тест курсива");
  });

  it("keeps multiple formatted children in one paragraph", () => {
    const blocks = sanitizeRichTextForDisplay([
      {
        type: "paragraph",
        children: [
          { text: "Первая фраза", bold: true },
          { text: ". " },
          { text: "Вторая фраза", bold: true },
        ],
      },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0].children).toHaveLength(3);
    expect(blocks?.[0].children[0].bold).toBe(true);
    expect(blocks?.[0].children[2].bold).toBe(true);
  });
});
