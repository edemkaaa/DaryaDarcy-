/** Вход маршрута /shop передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/shop/shop-screen";
export const metadata: Metadata = { title: "Магазин" };
export default function Page() {
  return <Screen />;
}
