import type { Metadata } from "next";
import Screen from "@/features/feed/feed-screen";
export const metadata: Metadata = { title: "Лента" };
export default function Page() {
  return <Screen />;
}
