import type { Metadata } from "next";
import Screen from "@/features/auth/login-screen";
export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; form?: string }>;
}) {
  const { next, form } = await searchParams;
  return <Screen next={next} formUnavailable={form === "unavailable"} />;
}
