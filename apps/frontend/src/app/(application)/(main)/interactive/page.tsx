import type { Metadata } from "next";
import Screen from "@/features/quiz/interactive-screen";
export const metadata: Metadata = { title: "Интерактив" };
export default function Page() {
  return <Screen />;
}
