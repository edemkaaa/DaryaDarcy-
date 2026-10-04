"use client";
import { type CSSProperties } from "react";
export const Spinner = ({
  size = "small",
  color = "#8b7355",
  style,
  className = "",
}: {
  size?: "small" | "large" | number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}) => (
  <div
    role="status"
    aria-label="Загрузка"
    className={`ui-spinner ${className}`}
    style={{
      width: size === "large" ? 36 : size === "small" ? 20 : size,
      height: size === "large" ? 36 : size === "small" ? 20 : size,
      borderColor: `${color}33`,
      borderTopColor: color,
      ...style,
    }}
  />
);
