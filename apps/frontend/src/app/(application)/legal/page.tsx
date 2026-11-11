/** Вход маршрута /legal передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/legal/legal-screen";
export const metadata: Metadata = { title: "Юридические документы" };
/** Отдаём обзор юридических документов; отдельные тексты открываются собственными маршрутами. */
export default function Page() {
  return <Screen />;
}
