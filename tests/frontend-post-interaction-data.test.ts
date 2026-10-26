import { describe, expect, it } from "vitest";
import {
  interactionBatches,
  requirePostInteractions,
} from "../apps/frontend/src/domain/post/post-interaction-data";

describe("bounded post interaction data", () => {
  it("keeps completed groups stable when older cards are appended", () => {
    const ids = Array.from({ length: 121 }, (_, i) => 200 - i);
    const before = interactionBatches(ids.slice(0, 60));
    const after = interactionBatches(ids);
    expect(after.map((batch) => batch.length)).toEqual([50, 50, 21]);
    expect(after[0]).toEqual(before[0]);
    expect(new Set(after.flat())).toEqual(new Set(ids));
    expect(
      after.every((batch) =>
        batch.every((id, i) => i === 0 || batch[i - 1] < id),
      ),
    ).toBe(true);
  });
  it("removes duplicate and invalid IDs before applying the wire limit", () => {
    expect(interactionBatches([2, 1, 2, 0, -1, 1.5, NaN, Infinity])).toEqual([
      [1, 2],
    ]);
    expect(interactionBatches([])).toEqual([]);
  });
  it("accepts empty marks for accessible posts and marks belonging to the requested set", () => {
    expect(
      requirePostInteractions({ likedIds: [], savedIds: [] }, [1]),
    ).toEqual({ likedIds: [], savedIds: [] });
    expect(
      requirePostInteractions({ likedIds: [1], savedIds: [2] }, [1, 2]),
    ).toEqual({ likedIds: [1], savedIds: [2] });
  });
  for (const value of [
    null,
    { likedIds: [3], savedIds: [] },
    { likedIds: ["1"], savedIds: [] },
    { likedIds: [], savedIds: null },
  ]) {
    it(`rejects incomplete or unrelated marks: ${JSON.stringify(value)}`, () => {
      expect(() => requirePostInteractions(value, [1, 2])).toThrow(
        "Некорректный ответ сервера",
      );
    });
  }
});
