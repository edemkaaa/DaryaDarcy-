/** Вход маршрута /library/patterns передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/library/patterns-screen";
export const metadata: Metadata = { title: "Выкройки" };
/** Подключаем страницу выкроек, где бесплатная и клубные выдачи различаются явно. */
export default function Page() {
  return <Screen />;
}
