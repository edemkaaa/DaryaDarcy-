/** Вход маршрута /library/aesthetics-guide передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/library/aesthetics-screen";
export const metadata: Metadata = { title: "Путеводитель по эстетикам" };
export default function Page() {
  return <Screen />;
}
