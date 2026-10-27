"use client";
/**
 * Quiz Entry Screen — "Тест: Какая твоя сказка?"
 * Shows welcome/intro, question flow, and results all managed via QuizContext.
 */
import { useEffect, useRef, useState } from "react";
import AsyncStorage, {
  requiredStorage,
  isPersonalDataOwner,
} from "@/shared/browser/storage";
import {
  QUIZ_PROGRESS_KEY,
  parseQuizProgress,
  serializeQuizProgress,
} from "@/domain/quiz/quiz-progress";
import { StatusNotice } from "@/shared/ui/status-notice";
import { parseSavedQuizResult } from "@/domain/quiz/saved-result";
import { useAuth } from "@/domain/session/session-context";
import {
  QuizContext,
  initialState,
  quizReducer,
  type QuizAction,
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
  const { loading, user } = useAuth();
  if (loading) return <RouteLoading path="/quiz" />;
  return (
    <QuizFlow
      key={`${user?.id ?? "guest"}:${showSavedResult}`}
      ownerId={user?.id ?? null}
      showSavedResult={showSavedResult}
    />
  );
}

function QuizFlow({
  ownerId,
  showSavedResult,
}: {
  ownerId: number | null;
  showSavedResult: boolean;
}) {
  const [state, setState] = useState(initialState);
  const current = useRef(state);
  const active = useScreenActive();
  const inspected = useRef<string | null | undefined>(undefined);
  const [inspectedOnce, setInspectedOnce] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const dispatch = (action: QuizAction) => {
    if (!isPersonalDataOwner(ownerId)) return;
    const next = quizReducer(current.current, action);
    try {
      if (next.phase === "question")
        requiredStorage.setItem(QUIZ_PROGRESS_KEY, serializeQuizProgress(next));
      else {
        // Commit the result before removing the last recoverable answers.
        if (next.result && !next.restored)
          requiredStorage.setItem(
            "@darcy_quiz_result",
            JSON.stringify({
              primaryKey: next.result.primary.key,
              secondaryKey: next.result.secondary?.key ?? null,
              isBlend: next.result.isBlend,
              scores: next.result.scores,
              completedAt: new Date().toISOString(),
            }),
          );
        requiredStorage.removeItem(QUIZ_PROGRESS_KEY);
      }
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    current.current = next;
    setState(next);
  };
  useEffect(() => {
    if (showSavedResult) return;
    try {
      const restored = parseQuizProgress(
        requiredStorage.getItem(QUIZ_PROGRESS_KEY),
      );
      if (restored) {
        current.current = restored;
        setState(restored);
      }
    } catch {
      setStorageError(true);
    }
    setInspectedOnce(true);
  }, [showSavedResult]);
  useEffect(() => {
    if (!showSavedResult || !active) return;
    let cancelled = false;
    void AsyncStorage.getItem("@darcy_quiz_result").then((raw) => {
      if (cancelled) return;
      if (inspected.current !== raw) {
        inspected.current = raw;
        const result = parseSavedQuizResult(raw);
        if (result) {
          const restored = quizReducer(current.current, {
            type: "RESTORE_RESULT",
            result,
          });
          current.current = restored;
          setState(restored);
        }
      }
      setInspectedOnce(true);
    });
    return () => {
      cancelled = true;
    };
  }, [showSavedResult, active]);
  if (!inspectedOnce) return <RouteLoading path="/quiz/result" />;
  return (
    <QuizContext.Provider value={{ state, dispatch }}>
      {storageError && (
        <StatusNotice tone="error">
          Прогресс теста не сохранён на устройстве. Не закрывайте страницу;
          разрешите хранение данных сайта.
        </StatusNotice>
      )}
      {state.phase === "welcome" && <QuizWelcome />}
      {state.phase === "question" && <QuizQuestion />}
      {state.phase === "result" && <QuizResultScreen />}
    </QuizContext.Provider>
  );
}

export function SavedQuizScreen() {
  return <QuizScreen showSavedResult />;
}
