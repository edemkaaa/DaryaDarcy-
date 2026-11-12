import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../apps/frontend/src/domain/quiz/quiz-data";

describe("quiz image alternatives", () => {
  const images = QUESTIONS.flatMap((question) =>
    question.answers.flatMap((answer) =>
      answer.image ? [{ id: answer.id, image: answer.image }] : [],
    ),
  );
  it("covers every image answer with distinct visual descriptions", () => {
    expect(images).toHaveLength(42);
    const descriptions = images.map(({ image }) => image.alt);
    expect(new Set(descriptions).size).toBe(images.length);
  });
  it.each(images)(
    "describes image $id without exposing its scoring category",
    ({ image }) => {
      expect(image.alt).toBeTypeOf("string");
      expect(image.alt?.trim().length).toBeGreaterThan(10);
      expect(image.alt).not.toMatch(
        /cottage|goblin|witch|castle|fairy|academia|изображение\s*\d/i,
      );
    },
  );
});
