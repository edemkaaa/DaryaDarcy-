"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useClub } from "@/domain/subscription/subscription-context";
import { BottomTabs } from "@/shared/ui/bottom-tabs";
import styles from "./tab-shell.module.scss";
export default function TabShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { isSubscribed } = useClub();
  return (
    <div className={"ui-stack " + styles.shell}>
      <main className={styles.content}>{children}</main>
      {!(path === "/club" && isSubscribed) && <BottomTabs />}
    </div>
  );
}
