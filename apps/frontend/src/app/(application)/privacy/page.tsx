/** Вход маршрута /privacy передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/legal/privacy-screen";
export const metadata: Metadata = { title: "Политика конфиденциальности" };
export default function Page() {
  return <Screen />;
}
