"use client";
/**
 * Quiz Entry Screen — "Тест: Какая твоя сказка?"
 * Shows welcome/intro, question flow, and results all managed via QuizContext.
 */
import { useEffect, useReducer, useRef, useState } from "react";
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
import { useScreenActive } from "@/shared/navigation/screen-activity";
import RouteLoading from "@/shared/ui/route-loading";
export default function QuizScreen({
  showSavedResult = false,
}: {
  showSavedResult?: boolean;
}) {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const active = useScreenActive();
  const { loading, user } = useAuth();
  const inspected = useRef<string | null | undefined>(undefined);
  const [inspectedOnce, setInspectedOnce] = useState(!showSavedResult);
  useEffect(() => {
    if (!showSavedResult || loading || !active) return;
    let cancelled = false;
    void AsyncStorage.getItem("@darcy_quiz_result").then((raw) => {
      if (cancelled) return;
      if (inspected.current !== raw) {
        inspected.current = raw;
        const result = parseSavedQuizResult(raw);
        if (result) dispatch({ type: "RESTORE_RESULT", result });
      }
      setInspectedOnce(true);
    });
    return () => {
      cancelled = true;
    };
  }, [showSavedResult, loading, user?.id, active]);
  if (!inspectedOnce) return <RouteLoading path="/quiz/result" />;
  return (
    <QuizContext.Provider value={{ state, dispatch }}>
      {state.phase === "welcome" && <QuizWelcome />}
      {state.phase === "question" && <QuizQuestion />}
      {state.phase === "result" && <QuizResultScreen />}
    </QuizContext.Provider>
  );
}

export function SavedQuizScreen() {
  return <QuizScreen showSavedResult />;
}
