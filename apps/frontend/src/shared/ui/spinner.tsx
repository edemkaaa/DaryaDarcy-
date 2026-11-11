"use client";
/** Индикатор ожидания имеет текстовую подпись для вспомогательных технологий и не сообщает результат операции. */
import { type CSSProperties } from "react";
export const Spinner = ({
  size = "small",
  color = "#6b7b5e",
  label = "Загрузка",
  style,
  className = "",
}: {
  size?: "small" | "large" | number;
  color?: string;
  label?: string;
  style?: CSSProperties;
  className?: string;
}) => (
  <div
    role="status"
    aria-label={label}
    className={`ui-spinner ${className}`}
    style={{
      width: size === "large" ? 36 : size === "small" ? 20 : size,
      height: size === "large" ? 36 : size === "small" ? 20 : size,
      color,
      borderWidth: size === "large" ? 3 : 2,
      ...style,
    }}
  />
);
