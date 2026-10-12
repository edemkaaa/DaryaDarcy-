import { expect, it } from "vitest";
import { parseSavedQuizResult } from "../apps/frontend/src/domain/quiz/saved-result";

const valid = {
  primaryKey: "cottagecore",
  primaryTitle: "Untrusted title",
  secondaryKey: null,
  isBlend: false,
  scores: {
    cottagecore: 21,
    goblincore: 0,
    witchcore: 0,
    castlecore: 0,
    fairycore: 0,
    darkAcademia: 0,
    lightAcademia: 0,
  },
};
it("restores canonical result content, not browser-supplied titles", () => {
  const result = parseSavedQuizResult(JSON.stringify(valid));
  expect(result?.primary.title).toBe(
    "Девушка, вернувшая жизнь заброшенному саду",
  );
  expect(result?.scores.cottagecore).toBe(21);
  expect(result?.secondary).toBeUndefined();
});
it("restores both canonical aesthetics for a stored blend", () => {
  const result = parseSavedQuizResult(
    JSON.stringify({ ...valid, isBlend: true, secondaryKey: "goblincore" }),
  );
  expect(result?.secondary?.key).toBe("goblincore");
  expect(result?.isBlend).toBe(true);
});
it.each([null, "{", "null", "x".repeat(4097)])(
  "rejects absent, malformed or oversized storage %s",
  (raw) => {
    expect(parseSavedQuizResult(raw)).toBeNull();
  },
);
it.each([
  { primaryKey: "__proto__" },
  { secondaryKey: "unknown", isBlend: true },
  { secondaryKey: "cottagecore", isBlend: true },
  { secondaryKey: "goblincore" },
  { isBlend: true },
  { scores: { cottagecore: 21 } },
  { scores: { ...valid.scores, cottagecore: -1 } },
  { scores: { ...valid.scores, cottagecore: 22 } },
  { scores: { ...valid.scores, cottagecore: "21" } },
])("rejects invalid keys, blend shape and scores %j", (patch) => {
  expect(
    parseSavedQuizResult(JSON.stringify({ ...valid, ...patch })),
  ).toBeNull();
});
