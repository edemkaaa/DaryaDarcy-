"use client";
/**
 * Quiz Entry Screen — "Тест: Какая твоя сказка?"
 * Shows welcome/intro, question flow, and results all managed via QuizContext.
 */
import { useReducer } from "react";
import {
  QuizContext,
  initialState,
  quizReducer,
} from "@/domain/quiz/quiz-state";
import { QuizWelcome } from "@/features/quiz/quiz-welcome";
import { QuizQuestion } from "@/features/quiz/quiz-question";
import { QuizResultScreen } from "@/features/quiz/quiz-result";
export default function QuizScreen() {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  return (
    <QuizContext.Provider value={{ state, dispatch }}>
      {state.phase === "welcome" && <QuizWelcome />}
      {state.phase === "question" && <QuizQuestion />}
      {state.phase === "result" && <QuizResultScreen />}
    </QuizContext.Provider>
  );
}
