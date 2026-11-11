/** Вход маршрута /videos передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/videos/videos-screen";
export const metadata: Metadata = { title: "Видео" };
export default function Page() {
  return <Screen />;
}
