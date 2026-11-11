/** Вход маршрута /library/about-me передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/library/about-screen";
export const metadata: Metadata = { title: "О Дарье Дарси" };
/** Показываем страницу автора под отдельным названием вкладки браузера. */
export default function Page() {
  return <Screen />;
}
