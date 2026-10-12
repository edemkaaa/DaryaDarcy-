import type { Metadata } from "next";
import EmailBindingScreen from "@/features/auth/email-binding-screen";

export const metadata: Metadata = {
  title: "Подтверждение почты",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <EmailBindingScreen />;
}
