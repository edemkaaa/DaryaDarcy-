import type { Metadata } from "next";
import Screen from "@/features/legal/privacy-screen";
export const metadata: Metadata = { title: "Политика конфиденциальности" };
export default function Page() {
  return <Screen />;
}
