"use client";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { publicPath } from "@/shared/navigation/router";
export function ZoomCard({
  route,
  style,
  className = "",
  children,
}: {
  route: string;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={publicPath(route)}
      className={`ui-action ui-navigation-card ${className}`}
      style={style}
    >
      <div className="ui-stack">{children}</div>
    </Link>
  );
}
