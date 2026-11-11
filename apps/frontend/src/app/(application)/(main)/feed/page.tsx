/** Вход маршрута /feed передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/feed/feed-screen";
export const metadata: Metadata = { title: "Лента" };
/** Подключаем экран ленты под метаданными маршрута; фильтры и страницы данных принадлежат feature-компоненту. */
export default function Page() {
  return <Screen />;
}
