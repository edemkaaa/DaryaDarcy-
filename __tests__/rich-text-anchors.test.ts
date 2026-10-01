import { describe, expect, it } from "vitest";
import { rangeForOccurrence, selectionOccurrence } from "../lib/rich-text-anchors";

describe("rich-text-anchors", () => {
  const text = "~ Осенний кемпинг\n• газовая плитка\n• клетчатая куртка\n• фонарь";

  it("tracks the nth occurrence of repeated anchor text", () => {
    const first = text.indexOf("• ");
    const second = text.indexOf("• ", first + 1);
    expect(selectionOccurrence(text, first, first + 2)).toBe(0);
    expect(selectionOccurrence(text, second, second + 2)).toBe(1);
  });

  it("resolves the same occurrence after unrelated text edits elsewhere", () => {
    const lanternStart = text.indexOf("фонарь");
    const occurrence = selectionOccurrence(text, lanternStart, lanternStart + "фонарь".length);
    const resolved = rangeForOccurrence(text, "фонарь", occurrence);
    expect(resolved).toEqual({ start: lanternStart, end: lanternStart + "фонарь".length });
  });

  it("does not confuse two different list items", () => {
    const stoveStart = text.indexOf("газовая плитка");
    const jacketStart = text.indexOf("клетчатая куртка");
    const stoveOccurrence = selectionOccurrence(text, stoveStart, stoveStart + "газовая плитка".length);
    const jacketOccurrence = selectionOccurrence(text, jacketStart, jacketStart + "клетчатая куртка".length);
    expect(rangeForOccurrence(text, "газовая плитка", stoveOccurrence)).toEqual({
      start: stoveStart,
      end: stoveStart + "газовая плитка".length,
    });
    expect(rangeForOccurrence(text, "клетчатая куртка", jacketOccurrence)).toEqual({
      start: jacketStart,
      end: jacketStart + "клетчатая куртка".length,
    });
  });
});
