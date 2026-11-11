/** Вход маршрута /quiz передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/quiz/quiz-screen";
export const metadata: Metadata = { title: "Какая твоя сказка?" };
export default function Page() {
  return <Screen />;
}
