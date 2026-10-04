import TabShell from "@/app/tab-shell";
import type { ReactNode } from "react";
export default function Layout({ children }: { children: ReactNode }) {
  return <TabShell>{children}</TabShell>;
}
