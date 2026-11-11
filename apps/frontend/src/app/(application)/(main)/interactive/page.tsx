/** Вход маршрута /interactive передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/quiz/interactive-screen";
export const metadata: Metadata = { title: "Интерактив" };
export default function Page() {
  return <Screen />;
}
