import { QUESTIONS } from "./quiz-data";
import type { QuizState } from "./quiz-state";

export const QUIZ_PROGRESS_KEY = "@darcy_quiz_progress";
const questions = JSON.stringify(
  QUESTIONS.map((q) => [q.id, q.answers.map((a) => a.id)]),
);

export function serializeQuizProgress(state: QuizState): string {
  return JSON.stringify({
    version: 1,
    questions,
    currentQuestion: state.currentQuestion,
    answers: state.answers,
  });
}

/** Stored answers are untrusted and belong to a particular question set. */
export function parseQuizProgress(raw: string | null): QuizState | null {
  if (!raw || raw.length > 16_384) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      value.questions !== questions ||
      !Number.isInteger(value.currentQuestion) ||
      value.currentQuestion < 0 ||
      value.currentQuestion >= QUESTIONS.length ||
      !Array.isArray(value.answers) ||
      value.answers.length !== QUESTIONS.length ||
      !value.answers.every(
        (answer: unknown, i: number) =>
          (answer === null ||
            QUESTIONS[i].answers.some((a) => a.id === answer)) &&
          (i >= value.currentQuestion || answer !== null),
      )
    )
      return null;
    return {
      phase: "question",
      currentQuestion: value.currentQuestion,
      answers: value.answers,
      result: null,
    };
  } catch {
    return null;
  }
}
