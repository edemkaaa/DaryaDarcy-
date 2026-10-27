import { describe, expect, it } from "vitest";
import {
  createPostInput,
  updatePostInput,
} from "../apps/backend/src/content/post-write-input";

const bytes = 65_535;
describe("post TEXT boundary measures UTF-8 bytes", () => {
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
  it.each(["a".repeat(bytes + 1), "я".repeat(40_000), "🌿".repeat(16_384)])(
    "rejects oversized input before persistence",
    (text) => {
      expect(
        createPostInput.safeParse({ text, photos: [], tags: [] }).success,
      ).toBe(false);
      expect(updatePostInput.safeParse({ id: 1, text }).success).toBe(false);
    },
  );
  it("preserves omitted and empty update text for the existing body policy", () => {
    expect(updatePostInput.parse({ id: 1 })).not.toHaveProperty("text");
    expect(updatePostInput.parse({ id: 1, text: "" }).text).toBe("");
  });
});
