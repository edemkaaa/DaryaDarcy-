import type { Metadata } from "next";
import Screen from "@/features/quiz/quiz-screen";
export const metadata: Metadata = { title: "Какая твоя сказка?" };
export default function Page() {
  return <Screen />;
}
