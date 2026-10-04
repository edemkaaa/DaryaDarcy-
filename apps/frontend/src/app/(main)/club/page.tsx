import type { Metadata } from "next";
import Screen from "@/features/club/club-screen";
export const metadata: Metadata = { title: "Клуб Darcy" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    paid?: string | string[];
    checkout?: string | string[];
  }>;
}) {
  const { paid, checkout } = await searchParams;
  return (
    <Screen
      paid={Array.isArray(paid) ? paid[0] : paid}
      checkout={Array.isArray(checkout) ? checkout[0] : checkout}
    />
  );
}
