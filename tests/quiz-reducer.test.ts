import { expect, it } from "vitest";
import {
  initialState,
  quizReducer,
} from "../apps/frontend/src/domain/quiz/quiz-state";
import { calculateResult } from "../apps/frontend/src/domain/quiz/quiz-data";

it("keeps the previous answer snapshot immutable when an answer changes", () => {
  const started = quizReducer(initialState, { type: "START_QUIZ" });
  const previous = { ...started, answers: ["1a", ...Array(9).fill(null)] };
  Object.freeze(previous.answers);
  const edited = quizReducer(previous, {
    type: "ANSWER",
    questionIndex: 0,
    answerId: "1b",
  });
  expect(previous.answers).toEqual(["1a", ...Array(9).fill(null)]);
  expect(edited.answers).toEqual(["1b", ...Array(9).fill(null)]);
  expect(edited.answers).not.toBe(previous.answers);
  expect(initialState.answers).toEqual(Array(10).fill(null));
});

it("retains selections when going back and calculates from the edited journey", () => {
  let state = quizReducer(initialState, { type: "START_QUIZ" });
  // Keep mutation probes isolated from the exported initial-state singleton.
  state = { ...state, answers: [...state.answers] };
  const answers = ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a"];
  for (let index = 0; index < 10; index++) {
    state = quizReducer(state, {
      type: "ANSWER",
      questionIndex: index,
      answerId: answers[index],
    });
    if (index < 9) state = quizReducer(state, { type: "NEXT_QUESTION" });
  }
  expect(state.currentQuestion).toBe(9);
  expect(state.phase).toBe("question");
  state = quizReducer(state, { type: "PREV_QUESTION" });
  expect(state.currentQuestion).toBe(8);
  expect(state.answers[9]).toBe("10a");
  state = quizReducer(state, {
    type: "ANSWER",
    questionIndex: 8,
    answerId: "9b",
  });
  state = quizReducer(state, { type: "NEXT_QUESTION" });
  state = quizReducer(state, { type: "NEXT_QUESTION" });
  expect(state.phase).toBe("result");
  expect(state.result?.primary.key).toBe("cottagecore");
  expect(state.result?.scores).toEqual({
    cottagecore: 19,
    goblincore: 2,
    witchcore: 0,
    castlecore: 0,
    fairycore: 0,
    darkAcademia: 0,
    lightAcademia: 0,
  });
});

it("does not navigate before the first question", () => {
  const started = quizReducer(initialState, { type: "START_QUIZ" });
  expect(quizReducer(started, { type: "PREV_QUESTION" }).currentQuestion).toBe(
    0,
  );
});

it("clears restored completion on restart and begins a fresh answer journey", () => {
  const result = calculateResult([
    "1a",
    "2a",
    "3a",
    "4a",
    "5a",
    "6a",
    "7a",
    "8a",
    "9a",
    "10a",
  ]);
  const restored = quizReducer(initialState, {
    type: "RESTORE_RESULT",
    result,
  });
  expect(restored.phase).toBe("result");
  expect(restored.restored).toBe(true);
  expect(restored.result).toBe(result);
  const restarted = quizReducer(restored, { type: "RESTART" });
  expect(restarted.phase).toBe("welcome");
  expect(restarted.result).toBeNull();
  expect(restarted.restored).toBeUndefined();
  const started = quizReducer(restored, { type: "START_QUIZ" });
  expect(started.phase).toBe("question");
  expect(started.currentQuestion).toBe(0);
  expect(started.answers).toEqual(Array(10).fill(null));
  expect(started.result).toBeNull();
  expect(started.restored).toBeUndefined();
});
