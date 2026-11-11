/** Вход маршрута /admin передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/admin/admin-screen";
export const metadata: Metadata = {
  title: "Администрирование",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Screen />;
}
