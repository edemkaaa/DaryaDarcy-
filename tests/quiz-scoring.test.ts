/** Независимые буквальные маршруты ответов проверяют веса эстетик, ранжирование и границу смешанного результата. */
import { expect, it } from "vitest";
import { calculateResult } from "../apps/frontend/src/domain/quiz/quiz-data";

// Literal answer IDs reflect each aesthetic, including the shuffled shelter IDs.
// Catches wrong answer mapping, lost home weight, ranking and blend boundaries.
/** Все десять ответов одной эстетики должны дать ровно 21 балл только ей, без вторичного результата. */
it.each([
  {
    key: "cottagecore",
    answers: ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a"],
    scores: [21, 0, 0, 0, 0, 0, 0],
  },
  {
    key: "goblincore",
    answers: ["1b", "2c", "3b", "4c", "5b", "6b", "7b", "8b", "9b", "10b"],
    scores: [0, 21, 0, 0, 0, 0, 0],
  },
  {
    key: "witchcore",
    answers: ["1c", "2b", "3c", "4e", "5c", "6c", "7c", "8c", "9c", "10c"],
    scores: [0, 0, 21, 0, 0, 0, 0],
  },
  {
    key: "castlecore",
    answers: ["1d", "2d", "3d", "4d", "5d", "6d", "7d", "8d", "9d", "10d"],
    scores: [0, 0, 0, 21, 0, 0, 0],
  },
  {
    key: "fairycore",
    answers: ["1e", "2e", "3e", "4f", "5e", "6e", "7e", "8e", "9e", "10e"],
    scores: [0, 0, 0, 0, 21, 0, 0],
  },
  {
    key: "darkAcademia",
    answers: ["1f", "2f", "3f", "4g", "5f", "6f", "7f", "8f", "9f", "10f"],
    scores: [0, 0, 0, 0, 0, 21, 0],
  },
  {
    key: "lightAcademia",
    answers: ["1g", "2g", "3g", "4b", "5g", "6g", "7g", "8g", "9g", "10g"],
    scores: [0, 0, 0, 0, 0, 0, 21],
  },
])(
  "scores a complete $key journey without inventing a secondary aesthetic",
  ({ key, answers, scores }) => {
    const result = calculateResult(answers);
    expect(result.primary.key).toBe(key);
    expect(result.isBlend).toBe(false);
    expect(result.secondary).toBeUndefined();
    expect([
      result.scores.cottagecore,
      result.scores.goblincore,
      result.scores.witchcore,
      result.scores.castlecore,
      result.scores.fairycore,
      result.scores.darkAcademia,
      result.scores.lightAcademia,
    ]).toEqual(scores);
  },
);

/** Разницы 1/3/5 баллов проверяют порядок двух эстетик и включительную границу blend; ожидаемые суммы заданы независимо. */
it.each([
  {
    label: "one-point difference",
    answers: ["1a", "2a", "3a", "4a", "5a", "6b", "7b", "8b", "9b", "10b"],
    cottage: 10,
    goblin: 11,
    primary: "goblincore",
    secondary: "cottagecore",
    blend: true,
  },
  {
    label: "inclusive three-point boundary",
    answers: ["1a", "2a", "3a", "4a", "5a", "6a", "7b", "8b", "9b", "10b"],
    cottage: 12,
    goblin: 9,
    primary: "cottagecore",
    secondary: "goblincore",
    blend: true,
  },
  {
    label: "outside the blend boundary",
    answers: ["1a", "2a", "3a", "4a", "5a", "6b", "7b", "8b", "9b", "10a"],
    cottage: 13,
    goblin: 8,
    primary: "cottagecore",
    secondary: undefined,
    blend: false,
  },
])(
  "ranks both aesthetics at $label",
  ({ answers, cottage, goblin, primary, secondary, blend }) => {
    const result = calculateResult(answers);
    expect(result.scores).toEqual({
      cottagecore: cottage,
      goblincore: goblin,
      witchcore: 0,
      castlecore: 0,
      fairycore: 0,
      darkAcademia: 0,
      lightAcademia: 0,
    });
    expect(result.primary.key).toBe(primary);
    expect(result.secondary?.key).toBe(secondary);
    expect(result.isBlend).toBe(blend);
  },
);
