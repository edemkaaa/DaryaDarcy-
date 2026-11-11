/** Вход маршрута /post/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/feed/post-screen";
export const metadata: Metadata = { title: "Пост" };
/** Передаём адрес поста экрану, который умеет разбирать публичный UUID и совместимый числовой ID. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Screen id={id} />;
}
