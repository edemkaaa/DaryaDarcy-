"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcons } from "./icons";
import styles from "./bottom-tabs.module.scss";

const tabs = [
  ["/feed", "Лента", "article"],
  ["/videos", "Видео", "play-circle-outline"],
  ["/club", "Клуб", "star"],
  ["/interactive", "Интерактив", "auto-awesome"],
  ["/library", "Библиотека", "menu-book"],
  ["/shop", "Магазин", "shopping-bag"],
] as const;

export function BottomTabs() {
  const path = usePathname();
  return (
    <nav className={styles.tabs} aria-label="Разделы">
      {tabs.map(([href, label, icon]) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            href={href}
            key={href}
            className={styles.tab}
            aria-current={active ? "page" : undefined}
          >
            <MaterialIcons
              name={icon}
              size={22}
              color={active ? "#5C4033" : "#8B7355"}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
