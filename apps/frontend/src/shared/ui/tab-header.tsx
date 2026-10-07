"use client";
import Link from "next/link";
import type { Ref } from "react";
import classes from "./tab-header.module.scss";
import { useRouter } from "@/shared/navigation/router";
import { TabMusicToggle } from "@/shared/ui/tab-music-toggle";

// Material Icons, Google (Apache-2.0): glyphs/material-icons-LICENSE.txt.
export function TabHeader({
  overlay = false,
  variant = "default",
  showBack = false,
  musicUrl,
  headerRef,
}: {
  overlay?: boolean;
  variant?: "default" | "home" | "shop";
  showBack?: boolean;
  musicUrl?: string;
  headerRef?: Ref<HTMLElement>;
}) {
  const router = useRouter();
  return (
    <header
      ref={headerRef}
      aria-label="Навигация профиля"
      className={[
        classes.header,
        overlay ? classes.overlay : "",
        classes[variant],
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={classes.group}>
        <Link href="/" aria-label="На главную" className={classes.action}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </Link>
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Вернуться назад"
            className={classes.action}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={classes.backIcon}
            >
              <path d="m14 6-6 6 6 6M8 12h12" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className={classes.group}>
        {musicUrl ? <TabMusicToggle url={musicUrl} /> : null}
        <Link
          href="/profile"
          aria-label="Открыть профиль"
          className={classes.action}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 7c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm6 5H6v-1c0-.64 3.13-2 6-2s6 1.36 6 2v1z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
