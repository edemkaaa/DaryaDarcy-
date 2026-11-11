/** Вход маршрута /admin передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/admin/admin-screen";
export const metadata: Metadata = {
  title: "Администрирование",
  robots: { index: false, follow: false },
};
/** Подключаем административный экран без индексации; проверка роли выполняется его контекстом и серверным API. */
export default function Page() {
  return <Screen />;
}
