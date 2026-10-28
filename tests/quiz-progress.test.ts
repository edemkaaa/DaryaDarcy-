import { expect, it } from "vitest";
import {
  parseQuizProgress,
  serializeQuizProgress,
} from "../apps/frontend/src/domain/quiz/quiz-progress";
import {
  initialState,
  quizReducer,
} from "../apps/frontend/src/domain/quiz/quiz-state";
import { QUESTIONS } from "../apps/frontend/src/domain/quiz/quiz-data";

const answered = quizReducer(
  quizReducer(initialState, { type: "START_QUIZ" }),
  { type: "ANSWER", questionIndex: 0, answerId: QUESTIONS[0].answers[0].id },
);
const next = quizReducer(answered, { type: "NEXT_QUESTION" });
it("restores selected answers with the current question", () => {
  expect(parseQuizProgress(serializeQuizProgress(next))).toEqual(next);
});
it.each([
  { version: 2 },
  { questions: "old questions" },
  { currentQuestion: -1 },
  { currentQuestion: QUESTIONS.length },
  { answers: [] },
  { answers: Array(QUESTIONS.length).fill("unknown-answer") },
  { answers: Array(QUESTIONS.length).fill(null) },
])("rejects incompatible or corrupted progress: %j", (change) => {
  expect(
    parseQuizProgress(
      JSON.stringify({ ...JSON.parse(serializeQuizProgress(next)), ...change }),
    ),
  ).toBeNull();
});

it("restores versioned progress while retaining a unique run and monotonic revision on the wire", () => {
  const run = { runId: "11111111-1111-4111-8111-111111111111", revision: 7 };
  const serialized = serializeQuizProgress(next, run);
  expect(JSON.parse(serialized)).toMatchObject({ version: 2, ...run });
  expect(parseQuizProgress(serialized)).toEqual(next);
});

it.each([
  { runId: "" },
  { runId: "old" },
  { revision: -1 },
  { revision: 1.5 },
  { revision: Number.MAX_SAFE_INTEGER + 1 },
])("rejects unsafe versioned quiz metadata: %j", (change) => {
  const raw = JSON.parse(
    serializeQuizProgress(next, {
      runId: "11111111-1111-4111-8111-111111111111",
      revision: 0,
    }),
  );
  expect(parseQuizProgress(JSON.stringify({ ...raw, ...change }))).toBeNull();
});
