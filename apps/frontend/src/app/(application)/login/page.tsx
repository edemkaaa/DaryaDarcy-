/** Вход маршрута /login передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/auth/login-screen";
export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false, follow: false },
};
/** Читаем асинхронные searchParams и передаём намерение возврата вместе с признаком догидратационной отправки формы. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; form?: string }>;
}) {
  const { next, form } = await searchParams;
  return <Screen next={next} formUnavailable={form === "unavailable"} />;
}
