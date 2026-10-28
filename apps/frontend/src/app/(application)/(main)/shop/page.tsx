import type { Metadata } from "next";
import Screen from "@/features/shop/shop-screen";
export const metadata: Metadata = { title: "Магазин" };
export default function Page() {
  return <Screen />;
}
