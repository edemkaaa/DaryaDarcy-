import type { Metadata } from "next";
import Screen from "@/features/library/library-screen";
export const metadata: Metadata = { title: "Библиотека" };
export default function Page() {
  return <Screen />;
}
