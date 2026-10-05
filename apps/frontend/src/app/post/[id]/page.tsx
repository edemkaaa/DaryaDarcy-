import type { Metadata } from "next";
import Screen from "@/features/feed/post-screen";
export const metadata: Metadata = { title: "Пост" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Screen id={id} />;
}
