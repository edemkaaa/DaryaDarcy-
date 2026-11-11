/** Входной контракт TEXT считает UTF-8 байты, а не число символов. */
import { describe, expect, it } from "vitest";
import {
  createPostInput,
  updatePostInput,
} from "../apps/backend/src/content/post-write-input";

const bytes = 65_535;
/** Одинаковая граница проверяется у создания и частичного редактирования поста. */
describe("post TEXT boundary measures UTF-8 bytes", () => {
  /** ASCII, кириллица и emoji заполняют ровно доступные 65 535 байт. */
  it.each([
    ["ASCII", "a".repeat(bytes)],
    ["Cyrillic", "я".repeat(32_767) + "a"],
    ["emoji", "🌿".repeat(16_383) + "abc"],
  ])("accepts exactly 65535 bytes of %s", (_label, text) => {
    expect(Buffer.byteLength(text, "utf8")).toBe(bytes);
    expect(
      createPostInput.safeParse({ text, photos: [], tags: [] }).success,
    ).toBe(true);
    expect(updatePostInput.safeParse({ id: 1, text }).success).toBe(true);
  });
  /** Строка сверх байтового лимита должна остановиться на Zod-валидации. */
  it.each(["a".repeat(bytes + 1), "я".repeat(40_000), "🌿".repeat(16_384)])(
    "rejects oversized input before persistence",
    (text) => {
      expect(
        createPostInput.safeParse({ text, photos: [], tags: [] }).success,
      ).toBe(false);
      expect(updatePostInput.safeParse({ id: 1, text }).success).toBe(false);
    },
  );
  /** Не смешиваем отсутствие patch-поля с явной пустой строкой: дальнейшая политика тела остаётся в сервисе. */
  it("preserves omitted and empty update text for the existing body policy", () => {
    expect(updatePostInput.parse({ id: 1 })).not.toHaveProperty("text");
    expect(updatePostInput.parse({ id: 1, text: "" }).text).toBe("");
  });
});
