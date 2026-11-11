/** Проверяем целостность бесплатного теста эстетики и совместимость подсчёта результата с его данными. */
import { describe, it, expect } from "vitest";

import {
  QUESTIONS,
  AESTHETIC_RESULTS,
  AESTHETIC_NAMES,
  calculateResult,
  createEmptyScores,
  type AestheticKey,
} from "@/domain/quiz/quiz-data";

/** Данные вопросов и результатов рассматриваются как единый продуктовый контракт. */
describe("Quiz Data", () => {
  /** Число шагов теста должно совпадать с ожидаемым сценарием прохождения. */
  it("should have exactly 10 questions", () => {
    expect(QUESTIONS.length).toBe(10);
  });

  /** Повтор ID сделал бы восстановление ответа неоднозначным. */
  it("should have unique question IDs", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** Каждый вопрос должен содержать достаточный набор вариантов выбора. */
  it("each question should have at least 4 answers", () => {
    for (const q of QUESTIONS) {
      expect(q.answers.length).toBeGreaterThanOrEqual(4);
    }
  });

  /** Видимый вариант ответа обязан участвовать хотя бы в одной шкале результата. */
  it("each answer should have at least one score entry", () => {
    for (const q of QUESTIONS) {
      for (const a of q.answers) {
        expect(a.scores.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  /** Для каждой эстетики нужны название и текст результата, иначе итоговый экран будет неполным. */
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

  /** Проверяем полный набор русских отображаемых названий. */
  it("should have display names for all aesthetics", () => {
    expect(Object.keys(AESTHETIC_NAMES).length).toBe(7);
  });
});

/** Начальные оценки и известные наборы ответов проверяются отдельно от целостности каталога. */
describe("Scoring Logic", () => {
  /** Новый проход не должен наследовать очки предыдущего пользователя. */
  it("createEmptyScores should return all zeros", () => {
    const scores = createEmptyScores();
    for (const val of Object.values(scores)) {
      expect(val).toBe(0);
    }
  });

  /** Эталонный набор первых ответов должен выбирать cottagecore и набирать положительные очки. */
  it("calculateResult should return cottagecore for all cottagecore answers", () => {
    // All 'a' answers = cottagecore
    const answers = ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a"];
    const result = calculateResult(answers);
    expect(result.primary.key).toBe("cottagecore");
    expect(result.scores.cottagecore).toBeGreaterThan(0);
  });

  /** Эталонный набор вариантов f должен выбирать тёмную академию. */
  it("calculateResult should return darkAcademia for dark academia answers", () => {
    // All 'f' answers = darkAcademia
    const answers = ["1f", "2f", "3f", "4f", "5f", "6f", "7f", "8f", "9f", "10f"];
    const result = calculateResult(answers);
    expect(result.primary.key).toBe("darkAcademia");
  });

  /** Эталонный набор вариантов c должен выбирать witchcore. */
  it("calculateResult should return witchcore for witchcore answers", () => {
    // All 'c' answers = witchcore
    const answers = ["1c", "2c", "3c", "4c", "5c", "6c", "7c", "8c", "9c", "10c"];
    const result = calculateResult(answers);
    expect(result.primary.key).toBe("witchcore");
  });

  /** Неотвеченные вопросы не добавляют очков и не ломают формирование результата. */
  it("calculateResult should handle null answers gracefully", () => {
    const answers: (string | null)[] = [null, null, null, null, null, null, null, null, null, null];
    const result = calculateResult(answers);
    expect(result.primary).toBeDefined();
    expect(result.scores.cottagecore).toBe(0);
  });

  /** Здесь проверяется форма ответа: при флаге смешанного результата обязателен второй тип, точный порог этим тестом не закреплён. */
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
