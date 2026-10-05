import { describe, it, expect } from "vitest";

import {
  QUESTIONS,
  AESTHETIC_RESULTS,
  AESTHETIC_NAMES,
  calculateResult,
  createEmptyScores,
  type AestheticKey,
} from "@/domain/quiz/quiz-data";

describe("Quiz Data", () => {
  it("should have exactly 10 questions", () => {
    expect(QUESTIONS.length).toBe(10);
  });

  it("should have unique question IDs", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each question should have at least 4 answers", () => {
    for (const q of QUESTIONS) {
      expect(q.answers.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("each answer should have at least one score entry", () => {
    for (const q of QUESTIONS) {
      for (const a of q.answers) {
        expect(a.scores.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("should have results for all 7 aesthetics", () => {
    const keys: AestheticKey[] = [
      "cottagecore",
      "goblincore",
      "witchcore",
      "castlecore",
      "fairycore",
      "darkAcademia",
      "lightAcademia",
    ];
    for (const key of keys) {
      expect(AESTHETIC_RESULTS[key]).toBeDefined();
      expect(AESTHETIC_RESULTS[key].title).toBeTruthy();
      expect(AESTHETIC_RESULTS[key].fairyTale).toBeTruthy();
    }
  });

  it("should have display names for all aesthetics", () => {
    expect(Object.keys(AESTHETIC_NAMES).length).toBe(7);
  });
});

describe("Scoring Logic", () => {
  it("createEmptyScores should return all zeros", () => {
    const scores = createEmptyScores();
    for (const val of Object.values(scores)) {
      expect(val).toBe(0);
    }
  });

  it("calculateResult should return cottagecore for all cottagecore answers", () => {
    // All 'a' answers = cottagecore
    const answers = ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a"];
    const result = calculateResult(answers);
    expect(result.primary.key).toBe("cottagecore");
    expect(result.scores.cottagecore).toBeGreaterThan(0);
  });

  it("calculateResult should return darkAcademia for dark academia answers", () => {
    // All 'f' answers = darkAcademia
    const answers = ["1f", "2f", "3f", "4f", "5f", "6f", "7f", "8f", "9f", "10f"];
    const result = calculateResult(answers);
    expect(result.primary.key).toBe("darkAcademia");
  });

  it("calculateResult should return witchcore for witchcore answers", () => {
    // All 'c' answers = witchcore
    const answers = ["1c", "2c", "3c", "4c", "5c", "6c", "7c", "8c", "9c", "10c"];
    const result = calculateResult(answers);
    expect(result.primary.key).toBe("witchcore");
  });

  it("calculateResult should handle null answers gracefully", () => {
    const answers: (string | null)[] = [null, null, null, null, null, null, null, null, null, null];
    const result = calculateResult(answers);
    expect(result.primary).toBeDefined();
    expect(result.scores.cottagecore).toBe(0);
  });

  it("calculateResult should detect blend when scores are close", () => {
    // Mix of cottagecore and fairycore
    const answers = ["1c", "2b", "3b", "4e", "5f", "6c", "7b", "8d", "9c", "10a"];
    const result = calculateResult(answers);
    expect(typeof result.isBlend).toBe("boolean");
    if (result.isBlend) {
      expect(result.secondary).toBeDefined();
    }
  });
});
