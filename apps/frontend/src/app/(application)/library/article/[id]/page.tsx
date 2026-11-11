/** Вход маршрута /library/article/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/library/article-screen";
export const metadata: Metadata = { title: "Материал библиотеки" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Screen id={id} />;
}
