/** Вход маршрута /profile передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/profile/profile-screen";
export const metadata: Metadata = {
  title: "Профиль",
  robots: { index: false, follow: false },
};
/** Подключаем личный профиль без поисковой индексации; эта обёртка не выдаёт права на приватные данные. */
export default function Page() {
  return <Screen />;
}
