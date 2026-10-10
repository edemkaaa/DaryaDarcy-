"use client";
/**
 * Quiz State Management
 * Uses React Context + useReducer for quiz flow state.
 */
import { createContext, useContext, type Dispatch } from "react";
import {
  QUESTIONS,
  calculateResult,
  type QuizResult,
} from "@/domain/quiz/quiz-data";
// ─── State ───────────────────────────────────────────────────────────────────
export type QuizPhase = "welcome" | "question" | "result";
export interface QuizState {
  phase: QuizPhase;
  currentQuestion: number; // 0-indexed
  answers: (string | null)[]; // answer id per question
  result: QuizResult | null;
  restored?: boolean;
}
const initialState: QuizState = {
  phase: "welcome",
  currentQuestion: 0,
  answers: Array(QUESTIONS.length).fill(null),
  result: null,
};
// ─── Actions ─────────────────────────────────────────────────────────────────
type QuizAction =
  | { type: "RESTORE_RESULT"; result: QuizResult }
  | {
      type: "START_QUIZ";
    }
  | {
      type: "ANSWER";
      questionIndex: number;
      answerId: string;
    }
  | {
      type: "NEXT_QUESTION";
    }
  | {
      type: "PREV_QUESTION";
    }
  | {
      type: "FINISH";
    }
  | {
      type: "RESTART";
    };
function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "RESTORE_RESULT":
      return {
        ...initialState,
        phase: "result",
        result: action.result,
        restored: true,
      };
    case "START_QUIZ":
      return { ...initialState, phase: "question" };
    case "ANSWER":
      const newAnswers = [...state.answers];
      newAnswers[action.questionIndex] = action.answerId;
      return { ...state, answers: newAnswers };
    case "NEXT_QUESTION":
      const next = state.currentQuestion + 1;
      if (next >= QUESTIONS.length) {
        const result = calculateResult(state.answers);
        return { ...state, phase: "result", result };
      }
      return { ...state, currentQuestion: next };
    case "PREV_QUESTION":
      return {
        ...state,
        currentQuestion: Math.max(0, state.currentQuestion - 1),
      };
    case "FINISH":
      const finalResult = calculateResult(state.answers);
      return { ...state, phase: "result", result: finalResult };
    case "RESTART":
      return initialState;
    default:
      return state;
  }
}
// ─── Context ─────────────────────────────────────────────────────────────────
interface QuizContextValue {
  state: QuizState;
  dispatch: Dispatch<QuizAction>;
}
export const QuizContext = createContext<QuizContextValue | null>(null);
export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuiz must be used within QuizProvider");
  return ctx;
}
export { initialState, quizReducer };
export type { QuizAction };
