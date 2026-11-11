"use client";
/** Нижние вкладки используют маршруты Next и состояние перехода, сохраняя корректные ссылки и доступные названия. */
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { parentRoute } from "@/shared/navigation/parent-route";
import { BottomTabIcon } from "./bottom-tab-icon";
import styles from "./bottom-tabs.module.scss";

const tabs = [
  ["/feed", "Лента", "article"],
  ["/videos", "Видео", "play-circle-outline"],
  ["/club", "Клуб", "star"],
  ["/interactive", "Интерактив", "auto-awesome"],
  ["/library", "Библиотека", "menu-book"],
  ["/shop", "Магазин", "shopping-bag"],
] as const;

function TabContents({
  label,
  icon,
}: {
  label: string;
  icon: (typeof tabs)[number][2];
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      <BottomTabIcon name={icon} className={styles.icon} />
      <span className={styles.label} aria-busy={pending}>
        {label}
      </span>
      <span
        className={styles.pendingText}
        role={pending ? "status" : undefined}
        aria-live="polite"
      >
        {pending ? `Открывается раздел «${label}»` : ""}
      </span>
    </>
  );
}

export function BottomTabs() {
  const path = usePathname();
  const section =
    path.startsWith("/post/") || path.startsWith("/video/") || path === "/quiz"
      ? parentRoute(path)
      : path;
  return (
    <nav className={styles.tabs} aria-label="Разделы">
      {tabs.map(([href, label, icon]) => {
        const active = section === href || section.startsWith(href + "/");
        return (
          <Link
            href={href}
            prefetch={false}
            key={href}
            aria-label={label}
            className={styles.tab}
            aria-current={active ? "page" : undefined}
          >
            <TabContents label={label} icon={icon} />
          </Link>
        );
      })}
    </nav>
  );
}
