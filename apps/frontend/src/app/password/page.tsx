import type { Metadata } from "next";
import PasswordScreen from "@/features/auth/password-screen";

export const metadata: Metadata = {
  title: "Установить пароль",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  manifest: null,
};

export default function Page() {
  return <PasswordScreen />;
}
