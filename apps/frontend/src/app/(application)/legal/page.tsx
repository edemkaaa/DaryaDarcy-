import type { Metadata } from "next";
import Screen from "@/features/legal/legal-screen";
export const metadata: Metadata = { title: "Юридические документы" };
export default function Page() {
  return <Screen />;
}
