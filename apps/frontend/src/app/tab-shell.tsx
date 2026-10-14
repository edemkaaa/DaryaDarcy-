"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomTabs } from "@/shared/ui/bottom-tabs";
import { TabHeader } from "@/shared/ui/tab-header";
import { CLUB_MUSIC_URL } from "@/shared/styles/tab-assets";
import { useScrollHeader } from "@/shared/browser/use-scroll-header";
import styles from "./tab-shell.module.scss";
import TabScreens from "./tab-screens";
import { SubscriptionCancellationProvider } from "@/features/profile/use-subscription-cancellation";
import { useAuth } from "@/domain/session/session-context";
export default function TabShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isPostDetail = path.startsWith("/post/");
  const { isOwner, user } = useAuth();
  const { headerRef, contentRef } = useScrollHeader(
    path,
    !isPostDetail && !["/videos", "/admin", "/profile"].includes(path),
  );
  const overlayHeader = ["/", "/feed", "/club", "/library", "/shop"].includes(
    path,
  );
  return (
    <SubscriptionCancellationProvider active={path === "/profile"}>
      <div className={"ui-stack " + styles.shell}>
        <TabHeader
          headerRef={headerRef}
          overlay={overlayHeader}
          variant={
            path === "/" ? "home" : path === "/shop" ? "shop" : "default"
          }
          showBack={path !== "/"}
          title={
            isPostDetail
              ? "Пост"
              : path === "/admin"
                ? user?.role === "moderator" && !isOwner
                  ? "Модерация"
                  : "Админка"
                : undefined
          }
          backHref={path === "/admin" ? "/profile" : undefined}
          musicUrl={path === "/club" ? CLUB_MUSIC_URL : undefined}
        />
        <main
          ref={contentRef}
          className={[styles.content, overlayHeader ? "" : styles.insetHeader]
            .filter(Boolean)
            .join(" ")}
        >
          <TabScreens path={path}>{children}</TabScreens>
        </main>
        <BottomTabs />
      </div>
    </SubscriptionCancellationProvider>
  );
}
