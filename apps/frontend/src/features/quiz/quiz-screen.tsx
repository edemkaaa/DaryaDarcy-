"use client";
/**
 * Quiz Entry Screen — "Тест: Какая твоя сказка?"
 * Shows welcome/intro, question flow, and results all managed via QuizContext.
 */
import { useEffect, useReducer, useRef } from "react";
import AsyncStorage from "@/shared/browser/storage";
import { parseSavedQuizResult } from "@/domain/quiz/saved-result";
import { useAuth } from "@/domain/session/session-context";
import {
  QuizContext,
  initialState,
  quizReducer,
} from "@/domain/quiz/quiz-state";
import { QuizWelcome } from "@/features/quiz/quiz-welcome";
import { QuizQuestion } from "@/features/quiz/quiz-question";
import { QuizResultScreen } from "@/features/quiz/quiz-result";
export default function QuizScreen({
  showSavedResult = false,
}: {
  showSavedResult?: boolean;
}) {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const { loading, user } = useAuth();
  const inspected = useRef(false);
  useEffect(() => {
    if (!showSavedResult || loading || inspected.current) return;
    let cancelled = false;
    void AsyncStorage.getItem("@darcy_quiz_result").then((raw) => {
      if (cancelled) return;
      inspected.current = true;
      const result = parseSavedQuizResult(raw);
      if (result) dispatch({ type: "RESTORE_RESULT", result });
    });
    return () => {
      cancelled = true;
    };
  }, [showSavedResult, loading, user?.id]);
  return (
    <QuizContext.Provider value={{ state, dispatch }}>
      {state.phase === "welcome" && <QuizWelcome />}
      {state.phase === "question" && <QuizQuestion />}
      {state.phase === "result" && <QuizResultScreen />}
    </QuizContext.Provider>
  );
}
