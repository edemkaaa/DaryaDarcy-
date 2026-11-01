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
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { withQuizStorageLock } from "@/domain/quiz/quiz-storage-lock";
import { parseSavedQuizResult } from "@/domain/quiz/saved-result";
import { useAuth } from "@/domain/session/session-context";
import {
  QuizContext,
  initialState,
  quizReducer,
  type QuizAction,
  type QuizState,
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
  const followingSavedResult = useRef(showSavedResult);
  const [resultVersion, setResultVersion] = useState(0);
  const [inspectedOnce, setInspectedOnce] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const stored = useRef<string | null>(null);
  const run = useRef<{ runId: string; revision: number } | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const queue = useRef(Promise.resolve());
  const setCurrent = (next: QuizState) => {
    current.current = next;
    setState(next);
  };
  const restoreProgress = (raw: string | null) => {
    const restored = parseQuizProgress(raw);
    stored.current = raw;
    const metadata = restored && raw ? JSON.parse(raw) : null;
    run.current =
      metadata?.version === 2
        ? { runId: metadata.runId, revision: metadata.revision }
        : null;
    return restored;
  };
  const renderedEpoch = epoch.current;
  const dispatch = (action: QuizAction) => {
    if (!isPersonalDataOwner(ownerId) || renderedEpoch !== epoch.current)
      return;
    const actionEpoch = renderedEpoch;
    const question = current.current.currentQuestion;
    queue.current = queue.current.then(async () => {
      let next: QuizState | null = null;
      const isCurrent = () =>
        mounted.current &&
        isPersonalDataOwner(ownerId) &&
        epoch.current === actionEpoch;
      try {
        await withQuizStorageLock(ownerId, () => {
          if (!isCurrent()) return;
          const raw = requiredStorage.getItem(QUIZ_PROGRESS_KEY);
          if (raw !== stored.current) {
            setChangedElsewhere(true);
            return;
          }
          const previous = current.current;
          if (
            action.type === "ANSWER" &&
            (previous.phase !== "question" ||
              action.questionIndex !== previous.currentQuestion)
          )
            return;
          if (
            (action.type === "NEXT_QUESTION" ||
              action.type === "PREV_QUESTION" ||
              action.type === "FINISH") &&
            (previous.phase !== "question" ||
              previous.currentQuestion !== question)
          )
            return;
          if (
            action.type === "NEXT_QUESTION" &&
            !previous.answers[previous.currentQuestion]
          )
            return;
          next = quizReducer(previous, action);
          if (action.type === "START_QUIZ" || action.type === "RESTART")
            followingSavedResult.current = false;
          if (next.phase === "question") {
            const metadata = run.current
              ? { ...run.current, revision: run.current.revision + 1 }
              : { runId: crypto.randomUUID(), revision: 0 };
            const encoded = serializeQuizProgress(next, metadata);
            requiredStorage.setItem(QUIZ_PROGRESS_KEY, encoded);
            if (requiredStorage.getItem(QUIZ_PROGRESS_KEY) !== encoded)
              throw new Error("Прогресс не сохранён");
            stored.current = encoded;
            run.current = metadata;
          } else {
            // Publish a completion before removing this run's recoverable answers.
            if (next.result && !next.restored) {
              const result = JSON.stringify({
                runId: run.current?.runId,
                primaryKey: next.result.primary.key,
                primaryTitle: next.result.primary.title,
                secondaryKey: next.result.secondary?.key ?? null,
                isBlend: next.result.isBlend,
                scores: next.result.scores,
                completedAt: new Date().toISOString(),
              });
              requiredStorage.setItem("@darcy_quiz_result", result);
              if (requiredStorage.getItem("@darcy_quiz_result") !== result)
                throw new Error("Результат не сохранён");
              inspected.current = result;
            }
            // A saved-result screen owns no in-progress run to delete.
            if (stored.current !== null)
              requiredStorage.removeItem(QUIZ_PROGRESS_KEY);
            stored.current = null;
            run.current = null;
            if (next.result && !next.restored)
              followingSavedResult.current = showSavedResult;
          }
          setStorageError(false);
          setChangedElsewhere(false);
          setCurrent(next);
          if (
            action.type === "START_QUIZ" ||
            action.type === "RESTART" ||
            next.phase === "result"
          )
            epoch.current++;
        });
      } catch {
        if (!isCurrent()) return;
        setStorageError(true);
        // Retain the answer in memory when the browser cannot persist it.
        if (next) setCurrent(next);
      }
    });
  };
  useEffect(() => {
    if (showSavedResult) return;
    try {
      const restored = restoreProgress(
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
    mounted.current = true;
    const inspect = (event?: StorageEvent) => {
      if (
        event &&
        event.key !== null &&
        event.key !== `darcy:user:${ownerId ?? "guest"}:${QUIZ_PROGRESS_KEY}`
      )
        return;
      if (!isPersonalDataOwner(ownerId)) return;
      try {
        if (requiredStorage.getItem(QUIZ_PROGRESS_KEY) !== stored.current)
          setChangedElsewhere(true);
      } catch {
        setStorageError(true);
      }
    };
    const onFocus = () => inspect();
    window.addEventListener("storage", inspect);
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      window.removeEventListener("storage", inspect);
      window.removeEventListener("focus", onFocus);
    };
  }, [ownerId]);
  const continueSaved = () => {
    const actionEpoch = epoch.current;
    queue.current = queue.current.then(async () => {
      try {
        await withQuizStorageLock(ownerId, () => {
          if (
            !mounted.current ||
            !isPersonalDataOwner(ownerId) ||
            epoch.current !== actionEpoch
          )
            return;
          const progress = restoreProgress(
            requiredStorage.getItem(QUIZ_PROGRESS_KEY),
          );
          const rawResult = progress
            ? null
            : requiredStorage.getItem("@darcy_quiz_result");
          const result = parseSavedQuizResult(rawResult);
          followingSavedResult.current = showSavedResult && !progress;
          if (!progress) {
            inspected.current = rawResult;
            setResultVersion((version) => version + 1);
          }
          epoch.current++;
          setCurrent(
            progress ??
              (result
                ? quizReducer(initialState, { type: "RESTORE_RESULT", result })
                : initialState),
          );
          setChangedElsewhere(false);
          setStorageError(false);
        });
      } catch {
        if (mounted.current && isPersonalDataOwner(ownerId))
          setStorageError(true);
      }
    });
  };
  useEffect(() => {
    if (!showSavedResult || !active) return;
    let cancelled = false;
    let readVersion = 0;
    const canRead = () =>
      !cancelled &&
      followingSavedResult.current &&
      isPersonalDataOwner(ownerId) &&
      current.current.phase !== "question";
    const load = () => {
      if (!canRead()) return;
      const version = ++readVersion;
      const loadEpoch = epoch.current;
      void AsyncStorage.getItem("@darcy_quiz_result").then((raw) => {
        if (
          !canRead() ||
          version !== readVersion ||
          loadEpoch !== epoch.current
        )
          return;
        if (inspected.current !== raw) {
          inspected.current = raw;
          const result = parseSavedQuizResult(raw);
          const restored = result
            ? quizReducer(initialState, { type: "RESTORE_RESULT", result })
            : initialState;
          current.current = restored;
          setState(restored);
          setResultVersion((value) => value + 1);
        }
        setInspectedOnce(true);
      });
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === `darcy:user:${ownerId ?? "guest"}:@darcy_quiz_result`
      )
        load();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", load);
    window.addEventListener("pageshow", load);
    load();
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", load);
      window.removeEventListener("pageshow", load);
    };
  }, [showSavedResult, active, ownerId]);
  useBackgroundNotice({
    when: storageError || changedElsewhere,
    priority: 1,
    message: storageError
      ? changedElsewhere
        ? "Тест не сохранён. В другой вкладке уже есть изменения."
        : "Прогресс теста не сохранён на устройстве. Не закрывайте страницу."
      : "Тест изменён в другой вкладке. Ваши ответы не перезаписаны.",
    actions: changedElsewhere
      ? [
          {
            id: "continue-saved-quiz",
            label: "Продолжить сохранённый тест",
            onClick: continueSaved,
          },
        ]
      : undefined,
  });
  if (!inspectedOnce) return <RouteLoading path="/quiz/result" />;
  return (
    <QuizContext.Provider value={{ state, dispatch }}>
      {state.phase === "welcome" && <QuizWelcome />}
      {state.phase === "question" && <QuizQuestion />}
      {state.phase === "result" && <QuizResultScreen key={resultVersion} />}
    </QuizContext.Provider>
  );
}

export function SavedQuizScreen() {
  return <QuizScreen showSavedResult />;
}
