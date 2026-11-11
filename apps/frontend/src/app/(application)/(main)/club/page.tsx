/** Вход маршрута /club передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import { Suspense } from "react";
import Screen from "@/features/club/club-screen";
import RouteLoading from "@/shared/ui/route-loading";
export const metadata: Metadata = { title: "Клуб Darcy" };
/** Отдаём экран Клуба внутри Suspense: чтение параметров возврата не должно блокировать всю оболочку приложения. */
export default function Page() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Screen />
    </Suspense>
  );
}
