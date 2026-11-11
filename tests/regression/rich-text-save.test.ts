/** Проверяем подготовку форматированного поста после нормализации обычного текста. */
import { describe, expect, it } from "vitest";
import { rangesToRichText } from "../../packages/shared/src/rich-text-ranges";
import { preparePostRichTextForSave } from "../../packages/shared/src/rich-text-save";

/** Сохранение должно согласовать очищенный текст с форматированием и текстовыми якорями. */
describe("rich-text-save", () => {
  /** Удаление лишних пробелов не должно потерять ссылку на товар. */
  it("keeps links after plain text whitespace normalization", () => {
    const rawText = "~ Октябрь\n• Клетчатое платье   \n• Фартук";
    const sanitizedText = "~ Октябрь\n• Клетчатое платье\n• Фартук";
    const linkRanges = [{ start: 12, end: 29, url: "https://example.com/dress" }];
    const blocks = rangesToRichText(rawText, [], [], linkRanges);
    const prepared = preparePostRichTextForSave(sanitizedText, blocks);
    expect(prepared.text).toBe(sanitizedText);
    expect(prepared.richText).not.toBeNull();
    expect(
      prepared.richText?.some((block) =>
        block.children.some((child) => child.link === "https://example.com/dress"),
      ),
    ).toBe(true);
  });

  /** При изменении только краевого пробела сохраняем структуру и жирное выделение. */
  it("preserves bold formatting instead of dropping rich text", () => {
    const text = "Жирный текст";
    const blocks = rangesToRichText(text, [[0, 6]], [], []);
    const prepared = preparePostRichTextForSave(`${text} `, blocks);
    expect(prepared.richText).not.toBeNull();
    expect(prepared.richText?.[0].children.some((child) => child.bold)).toBe(true);
  });

  /** Два неизменившихся якоря позволяют сохранить обе ссылки после очистки пробелов. */
  it("recovers links when plain text is sanitized but anchor text stays the same", () => {
    const rawText = "• Платье   \n• Фартук";
    const sanitizedText = "• Платье\n• Фартук";
    const linkRanges = [
      { start: 2, end: 8, url: "https://example.com/dress" },
      { start: 11, end: 17, url: "https://example.com/apron" },
    ];
    const blocks = rangesToRichText(rawText, [], [], linkRanges);
    const prepared = preparePostRichTextForSave(sanitizedText, blocks);
    expect(
      prepared.richText?.flatMap((block) => block.children).filter((child) => child.link),
    ).toHaveLength(2);
  });
});
