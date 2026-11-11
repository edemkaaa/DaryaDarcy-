/** Вход маршрута /video/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import Screen from "@/features/videos/video-screen";
export const metadata: Metadata = { title: "Видео" };
/** Передаём ID странице ролика; серверный источник воспроизведения запрашивается уже в её жизненном цикле. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Screen id={id} />;
}
