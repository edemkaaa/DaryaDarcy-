// Архив Expo. Держит один reducer для welcome, вопросов и результата в пределах теста.
/**
 * Quiz Entry Screen — "Тест: Какая твоя сказка?"
 * Shows welcome/intro, question flow, and results all managed via QuizContext.
 */
import React, { useReducer } from "react";
import { QuizContext, initialState, quizReducer } from "@/lib/quiz-state";
import { QuizWelcome } from "@/components/quiz/quiz-welcome";
import { QuizQuestion } from "@/components/quiz/quiz-question";
import { QuizResultScreen } from "@/components/quiz/quiz-result";

export default function QuizScreen() {
  // Держит один reducer для welcome, вопросов и результата в пределах теста.

  const [state, dispatch] = useReducer(quizReducer, initialState);

  return (
    <QuizContext.Provider value={{ state, dispatch }}>
      {state.phase === "welcome" && <QuizWelcome />}
      {state.phase === "question" && <QuizQuestion />}
      {state.phase === "result" && <QuizResultScreen />}
    </QuizContext.Provider>
  );
}
