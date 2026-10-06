"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomTabs } from "@/shared/ui/bottom-tabs";
import { TabHeader } from "@/shared/ui/tab-header";
import { CLUB_MUSIC_URL } from "@/shared/styles/tab-assets";
import styles from "./tab-shell.module.scss";
export default function TabShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const overlayHeader = ["/", "/feed", "/club", "/library", "/shop"].includes(
    path,
  );
  return (
    <div className={"ui-stack " + styles.shell}>
      <TabHeader
        overlay={overlayHeader}
        variant={path === "/" ? "home" : path === "/shop" ? "shop" : "default"}
        showBack={path !== "/"}
        musicUrl={path === "/club" ? CLUB_MUSIC_URL : undefined}
      />
      <main
        className={[styles.content, overlayHeader ? "" : styles.insetHeader]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </main>
      <BottomTabs />
    </div>
  );
}
