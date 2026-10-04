import type { Metadata } from "next";
import Screen from "@/features/profile/profile-screen";
export const metadata: Metadata = {
  title: "Профиль",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Screen />;
}
