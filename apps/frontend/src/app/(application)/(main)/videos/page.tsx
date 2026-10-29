import type { Metadata } from "next";
import Screen from "@/features/videos/videos-screen";
export const metadata: Metadata = { title: "Видео" };
export default function Page() {
  return <Screen />;
}
