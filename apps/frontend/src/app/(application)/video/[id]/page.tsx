import type { Metadata } from "next";
import Screen from "@/features/videos/video-screen";
export const metadata: Metadata = { title: "Видео" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Screen id={id} />;
}
