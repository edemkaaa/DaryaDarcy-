/** Вход маршрута /quiz/result передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/quiz/quiz-screen";
export const metadata: Metadata = { title: "Результат — Какая твоя сказка?" };
/** Запрашиваем режим сохранённого результата, не создавая новый проход теста автоматически. */
export default function Page() {
  return <Screen showSavedResult />;
}
