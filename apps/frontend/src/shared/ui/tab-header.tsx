"use client";
import Link from "next/link";
import { forwardRef } from "react";
import classes from "./tab-header.module.scss";
import { MaterialIcons } from "@/shared/ui/icons";
import { TabMusicToggle } from "@/shared/ui/tab-music-toggle";

interface TabHeaderProps {
  transparent?: boolean;
  musicUrl?: string;
  variant?: "default" | "home" | "shop";
}
export const TabHeader = forwardRef<HTMLElement, TabHeaderProps>(
  function TabHeader(
    { transparent = true, musicUrl, variant = "default" },
    ref,
  ) {
    const iconColor =
      variant === "home"
        ? "rgba(255,255,255,0.9)"
        : variant === "shop"
          ? "#FDF8F0"
          : transparent
            ? "#FFFFFF"
            : "#5C4033";
    return (
      <header
        ref={ref}
        aria-label="Навигация профиля"
        className={`ui-stack ${classes.header} ${transparent ? classes.overlay : ""} ${variant === "default" ? "" : classes[variant]}`}
      >
        <Link
          href="/"
          aria-label="На главную"
          className={`ui-action ${classes.action}`}
        >
          <MaterialIcons name="home" size={22} color={iconColor} />
        </Link>
        <div className={`ui-stack ${classes.rightGroup}`}>
          {musicUrl ? (
            <TabMusicToggle url={musicUrl} iconColor={iconColor} />
          ) : null}
          <Link
            href="/profile"
            aria-label="Открыть профиль"
            className={`ui-action ${classes.action}`}
          >
            <MaterialIcons name="person-outline" size={22} color={iconColor} />
          </Link>
        </div>
      </header>
    );
  },
);
