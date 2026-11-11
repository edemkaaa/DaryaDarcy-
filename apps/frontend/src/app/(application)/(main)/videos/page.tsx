/** Вход маршрута /videos передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/videos/videos-screen";
export const metadata: Metadata = { title: "Видео" };
/** Подключаем список видео; новый или совместимый каталог выбирается feature-компонентом по настройке сборки. */
export default function Page() {
  return <Screen />;
}
